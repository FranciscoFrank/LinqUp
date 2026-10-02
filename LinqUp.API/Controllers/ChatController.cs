using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Services;
using LinqUp.Shared;
using LinqUp.Shared.Dtos.Chat;
using LinqUp.Shared.Dtos.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Authorize]
    [Route("api/projects/{projectId:guid}/[controller]")]
    [ApiController]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IFileStorageService _fileStorage;

        public ChatController(AppDbContext db, IFileStorageService fileStorage)
        {
            _db = db;
            _fileStorage = fileStorage;
        }

        private Guid? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }

        private async Task<bool> IsProjectMemberAsync(Guid projectId, Guid userId)
        {
            return await _db.ProjectMemberships
                .AsNoTracking()
                .AnyAsync(m => m.TeamProjectId == projectId && m.UserId == userId);
        }

        // GET: api/projects/{projectId}/chat/messages
        [HttpGet("messages")]
        public async Task<ActionResult<IEnumerable<TeamMessageDto>>> GetMessages(
            Guid projectId,
            [FromQuery] DateTime? before,
            [FromQuery] int limit = 30)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            limit = Math.Clamp(limit, 1, 100);

            var query = _db.TeamMessages
                .AsNoTracking()
                .Include(m => m.Attachments)
                .Include(m => m.Mentions)
                .Where(m => m.TeamProjectId == projectId);

            if (before.HasValue)
            {
                query = query.Where(m => m.CreatedAt < before.Value);
            }

            var messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .Take(limit)
                .ToListAsync();

            // Reverse to chronological order for client display
            messages.Reverse();

            var senderIds = messages.Select(m => m.SenderId).Distinct().ToList();
            var senders = await _db.Users
                .AsNoTracking()
                .Where(u => senderIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            var messageIds = messages.Select(m => m.Id).ToList();
            var reactions = await _db.MessageReactions
                .AsNoTracking()
                .Where(r => messageIds.Contains(r.TeamMessageId))
                .Join(_db.Users, r => r.UserId, u => u.Id, (r, u) => new { r.TeamMessageId, r.UserId, r.Emoji, u.Nickname })
                .ToListAsync();

            var reactionsByMessage = reactions
                .GroupBy(r => r.TeamMessageId)
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(x => x.Emoji).Select(eg => new ReactionDto
                    {
                        Emoji = eg.Key,
                        Count = eg.Count(),
                        UserNicknames = eg.Select(x => x.Nickname).Distinct().ToList(),
                        HasReacted = eg.Any(x => x.UserId == userId.Value)
                    }).ToList()
                );

            var result = messages.Select(m =>
            {
                senders.TryGetValue(m.SenderId, out var sender);

                CodeQuoteDto? quote = null;
                var content = m.Content;
                var match = System.Text.RegularExpressions.Regex.Match(m.Content, @"^\[codequote:(\{.*?\})\]\r?\n?(.*)$", System.Text.RegularExpressions.RegexOptions.Singleline);
                if (match.Success)
                {
                    try
                    {
                        quote = System.Text.Json.JsonSerializer.Deserialize<CodeQuoteDto>(match.Groups[1].Value);
                        content = match.Groups[2].Value;
                    }
                    catch { }
                }

                reactionsByMessage.TryGetValue(m.Id, out var messageReactions);

                return new TeamMessageDto
                {
                    Id = m.Id,
                    TeamProjectId = m.TeamProjectId,
                    SenderId = m.SenderId,
                    SenderFullName = sender?.FullName ?? "Учасник",
                    SenderNickname = sender?.Nickname ?? string.Empty,
                    SenderAvatarPath = sender?.AvatarPath,
                    Content = content,
                    CodeQuote = quote,
                    Reactions = messageReactions ?? new List<ReactionDto>(),
                    CreatedAt = m.CreatedAt,
                    Attachments = m.Attachments.Select(a => new AttachmentDto
                    {
                        Id = a.Id,
                        OriginalFileName = a.OriginalFileName,
                        ContentType = a.ContentType,
                        FileSize = a.FileSize,
                        IsImage = a.IsImage,
                        DownloadUrl = $"/api/projects/{projectId}/chat/attachments/{a.Id}/download",
                        ViewUrl = $"/api/projects/{projectId}/chat/attachments/{a.Id}/view"
                    }).ToList(),
                    Mentions = m.Mentions.Select(men => new MentionDto
                    {
                        UserId = men.MentionedUserId,
                        Nickname = men.MentionedNickname
                    }).ToList()
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/projects/{projectId}/chat/attachments
        [HttpPost("attachments")]
        [RequestSizeLimit(60 * 1024 * 1024)] // 60 MB total payload limit
        public async Task<ActionResult<IEnumerable<AttachmentDto>>> UploadAttachments(
            Guid projectId,
            [FromForm] List<IFormFile> files)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest("Файли для завантаження не передано.");
            }

            if (files.Count > 10)
            {
                return BadRequest("За один раз можна прикріпити щонайбільше 10 файлів.");
            }

            var savedAttachments = new List<MessageAttachment>();

            foreach (var file in files)
            {
                var (attachment, error) = await _fileStorage.SaveAttachmentAsync(projectId, file);
                if (error != null)
                {
                    // Clean up already saved files in case of failure
                    foreach (var alreadySaved in savedAttachments)
                    {
                        _fileStorage.DeleteAttachmentFile(projectId, alreadySaved.StorageFileName);
                    }
                    return BadRequest($"Помилка у файлі '{file.FileName}': {error}");
                }

                if (attachment != null)
                {
                    savedAttachments.Add(attachment);
                }
            }

            _db.MessageAttachments.AddRange(savedAttachments);
            await _db.SaveChangesAsync();

            var result = savedAttachments.Select(a => new AttachmentDto
            {
                Id = a.Id,
                OriginalFileName = a.OriginalFileName,
                ContentType = a.ContentType,
                FileSize = a.FileSize,
                IsImage = a.IsImage,
                DownloadUrl = $"/api/projects/{projectId}/chat/attachments/{a.Id}/download",
                ViewUrl = $"/api/projects/{projectId}/chat/attachments/{a.Id}/view"
            }).ToList();

            return Ok(result);
        }

        // GET: api/projects/{projectId}/chat/attachments/{attachmentId}/download
        [HttpGet("attachments/{attachmentId:guid}/download")]
        public async Task<IActionResult> DownloadAttachment(Guid projectId, Guid attachmentId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            var attachment = await _db.MessageAttachments
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == attachmentId);

            if (attachment == null) return NotFound("Вкладення не знайдено.");

            var physicalPath = _fileStorage.GetPhysicalFilePath(projectId, attachment.StorageFileName);
            if (physicalPath == null) return NotFound("Файл на диску відсутній.");

            // PhysicalFile handles RFC 5987 / RFC 6266 filename encoding, range headers, and zero-copy streaming
            return PhysicalFile(
                physicalPath,
                attachment.ContentType,
                fileDownloadName: attachment.OriginalFileName,
                enableRangeProcessing: true);
        }

        // GET: api/projects/{projectId}/chat/attachments/{attachmentId}/view
        [HttpGet("attachments/{attachmentId:guid}/view")]
        public async Task<IActionResult> ViewAttachment(Guid projectId, Guid attachmentId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            var attachment = await _db.MessageAttachments
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == attachmentId);

            if (attachment == null) return NotFound("Вкладення не знайдено.");

            var physicalPath = _fileStorage.GetPhysicalFilePath(projectId, attachment.StorageFileName);
            if (physicalPath == null) return NotFound("Файл на диску відсутній.");

            // Inline view (no download disposition) for <img> or PDF view
            return PhysicalFile(physicalPath, attachment.ContentType, enableRangeProcessing: true);
        }

        // GET: api/projects/{projectId}/chat/members
        [HttpGet("members")]
        public async Task<ActionResult<IEnumerable<ProjectMemberDto>>> GetTeamMembersForChat(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            var project = await _db.TeamProjects
                .AsNoTracking()
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return NotFound("Проєкт не знайдено.");

            var memberUserIds = project.Members.Select(m => m.UserId).Distinct().ToList();
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => memberUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            var result = project.Members.Select(m =>
            {
                users.TryGetValue(m.UserId, out var u);
                return new ProjectMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    FullName = u?.FullName ?? "Учасник",
                    Nickname = u?.Nickname ?? string.Empty,
                    AvatarPath = u?.AvatarPath,
                    Role = m.Role,
                    JoinedAt = m.JoinedAt,
                    IsLeader = m.UserId == project.CreatorId
                };
            }).OrderBy(m => m.FullName).ToList();

            return Ok(result);
        }
    }
}
