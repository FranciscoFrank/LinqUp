using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Identity;
using LinqUp.Shared;
using LinqUp.Shared.Dtos.Chat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LinqUp.API.Hubs
{
    [Authorize]
    public class TeamChatHub : Hub
    {
        private readonly AppDbContext _db;
        private readonly ILogger<TeamChatHub> _logger;

        public TeamChatHub(AppDbContext db, ILogger<TeamChatHub> logger)
        {
            _db = db;
            _logger = logger;
        }

        private Guid? GetCurrentUserId()
        {
            var sub = Context.User?.FindFirst("sub")?.Value
                   ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return Guid.TryParse(sub, out var id) ? id : null;
        }

        public async Task JoinTeamChat(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                throw new HubException("Не вдалося ідентифікувати користувача.");
            }

            var isMember = await _db.ProjectMemberships
                .AsNoTracking()
                .AnyAsync(m => m.TeamProjectId == projectId && m.UserId == userId.Value);

            if (!isMember)
            {
                throw new HubException("Ви не є учасником цієї команди.");
            }

            var groupName = GetGroupName(projectId);
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            await Clients.Caller.SendAsync("JoinedTeamChat", projectId);
        }

        public async Task LeaveTeamChat(Guid projectId)
        {
            var groupName = GetGroupName(projectId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task SendTyping(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return;

            var isMember = await _db.ProjectMemberships
                .AsNoTracking()
                .AnyAsync(m => m.TeamProjectId == projectId && m.UserId == userId.Value);

            if (!isMember) return;

            var user = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == userId.Value)
                .Select(u => new { u.Nickname })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                var groupName = GetGroupName(projectId);
                await Clients.OthersInGroup(groupName).SendAsync("UserTyping", new TypingNotificationDto
                {
                    ProjectId = projectId,
                    UserId = userId.Value,
                    Nickname = user.Nickname
                });
            }
        }

        public async Task SendMessage(SendMessageDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                throw new HubException("Не вдалося ідентифікувати користувача.");
            }

            var isMember = await _db.ProjectMemberships
                .AsNoTracking()
                .AnyAsync(m => m.TeamProjectId == dto.ProjectId && m.UserId == userId.Value);

            if (!isMember)
            {
                throw new HubException("Тільки учасники команди можуть писати в чат.");
            }

            if (string.IsNullOrWhiteSpace(dto.Content) && (dto.AttachmentIds == null || dto.AttachmentIds.Count == 0))
            {
                throw new HubException("Повідомлення не може бути порожнім.");
            }

            var sender = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (sender == null)
            {
                throw new HubException("Користувача не знайдено.");
            }

            var rawContent = dto.Content?.Trim() ?? string.Empty;
            if (dto.CodeQuote != null)
            {
                var quoteJson = System.Text.Json.JsonSerializer.Serialize(dto.CodeQuote);
                rawContent = $"[codequote:{quoteJson}]\n{rawContent}";
            }

            var message = new TeamMessage
            {
                Id = Guid.CreateVersion7(),
                TeamProjectId = dto.ProjectId,
                SenderId = userId.Value,
                Content = rawContent,
                CreatedAt = DateTime.UtcNow
            };

            // Associate pre-uploaded attachments
            if (dto.AttachmentIds != null && dto.AttachmentIds.Count > 0)
            {
                var attachments = await _db.MessageAttachments
                    .Where(a => dto.AttachmentIds.Contains(a.Id) && (a.TeamMessageId == null || a.TeamMessageId == Guid.Empty))
                    .ToListAsync();

                foreach (var att in attachments)
                {
                    att.TeamMessageId = message.Id;
                    message.Attachments.Add(att);
                }
            }

            // Detect @mentions from message content
            var mentionMatches = Regex.Matches(message.Content, @"@([a-zA-Z0-9_]{3,30})");
            var mentionedNicknames = mentionMatches
                .Select(m => m.Groups[1].Value.ToLowerInvariant())
                .Distinct()
                .ToList();

            if (mentionedNicknames.Count > 0)
            {
                // Query team members with these nicknames
                var teamMemberUsers = await _db.ProjectMemberships
                    .Where(pm => pm.TeamProjectId == dto.ProjectId)
                    .Join(_db.Users, pm => pm.UserId, u => u.Id, (pm, u) => new { u.Id, u.Nickname })
                    .Where(u => mentionedNicknames.Contains(u.Nickname.ToLower()))
                    .ToListAsync();

                foreach (var mentioned in teamMemberUsers)
                {
                    message.Mentions.Add(new MessageMention
                    {
                        Id = Guid.CreateVersion7(),
                        TeamMessageId = message.Id,
                        MentionedUserId = mentioned.Id,
                        MentionedNickname = mentioned.Nickname
                    });
                }
            }

            _db.TeamMessages.Add(message);
            await _db.SaveChangesAsync();

            var messageDto = new TeamMessageDto
            {
                Id = message.Id,
                TeamProjectId = message.TeamProjectId,
                SenderId = sender.Id,
                SenderFullName = $"{sender.FirstName} {sender.LastName}".Trim(),
                SenderNickname = sender.Nickname,
                SenderAvatarPath = sender.AvatarPath,
                Content = dto.Content?.Trim() ?? string.Empty,
                CodeQuote = dto.CodeQuote,
                CreatedAt = message.CreatedAt,
                Attachments = message.Attachments.Select(a => new AttachmentDto
                {
                    Id = a.Id,
                    OriginalFileName = a.OriginalFileName,
                    ContentType = a.ContentType,
                    FileSize = a.FileSize,
                    IsImage = a.IsImage,
                    DownloadUrl = $"/api/projects/{message.TeamProjectId}/chat/attachments/{a.Id}/download",
                    ViewUrl = $"/api/projects/{message.TeamProjectId}/chat/attachments/{a.Id}/view"
                }).ToList(),
                Mentions = message.Mentions.Select(m => new MentionDto
                {
                    UserId = m.MentionedUserId,
                    Nickname = m.MentionedNickname
                }).ToList()
            };

            var groupName = GetGroupName(dto.ProjectId);
            await Clients.Group(groupName).SendAsync("ReceiveMessage", messageDto);
        }

        public async Task ToggleReaction(ToggleReactionDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return;

            var isMember = await _db.ProjectMemberships
                .AsNoTracking()
                .AnyAsync(m => m.TeamProjectId == dto.ProjectId && m.UserId == userId.Value);

            if (!isMember) return;

            var message = await _db.TeamMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == dto.MessageId && m.TeamProjectId == dto.ProjectId);

            if (message == null) return;

            var user = await _db.Users.FindAsync(userId.Value);
            if (user == null) return;

            var emoji = dto.Emoji.Trim();
            var existingReaction = await _db.MessageReactions
                .FirstOrDefaultAsync(r => r.TeamMessageId == dto.MessageId && r.UserId == userId.Value && r.Emoji == emoji);

            bool isAdded;
            if (existingReaction != null)
            {
                _db.MessageReactions.Remove(existingReaction);
                isAdded = false;
            }
            else
            {
                _db.MessageReactions.Add(new MessageReaction
                {
                    Id = Guid.CreateVersion7(),
                    TeamMessageId = dto.MessageId,
                    UserId = userId.Value,
                    Emoji = emoji,
                    CreatedAt = DateTime.UtcNow
                });
                isAdded = true;
            }

            await _db.SaveChangesAsync();

            var count = await _db.MessageReactions
                .CountAsync(r => r.TeamMessageId == dto.MessageId && r.Emoji == emoji);

            var groupName = GetGroupName(dto.ProjectId);
            await Clients.Group(groupName).SendAsync("ReactionToggled", new
            {
                MessageId = dto.MessageId,
                Emoji = emoji,
                Count = count,
                UserId = userId.Value,
                UserNickname = user.Nickname,
                IsAdded = isAdded
            });
        }

        private static string GetGroupName(Guid projectId) => $"Team_{projectId:N}";
    }
}
