using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Identity;
using LinqUp.API.Services;
using LinqUp.Shared;
using LinqUp.Shared.Dtos.Projects;
using LinqUp.Shared.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITeamLogoStorageService _logoStorage;

        public ProjectsController(AppDbContext db, ITeamLogoStorageService logoStorage)
        {
            _db = db;
            _logoStorage = logoStorage;
        }

        private Guid? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }

        private static int? CalculateMatchScore(string? projectSkills, string? projectTitle, string? projectDescription, string? projectRepo, HashSet<string>? userSkills, string? userGoal)
        {
            if (userSkills == null || userSkills.Count == 0) return null;

            var reqSkills = (projectSkills ?? "")
                .Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .Distinct()
                .ToList();

            double score = 0;
            if (reqSkills.Count > 0)
            {
                int matched = reqSkills.Count(s => userSkills.Contains(s));
                double skillRatio = (double)matched / reqSkills.Count;
                score += skillRatio * 75.0; // Up to 75 points for skills
            }
            else
            {
                score += 45.0; // Base score if project has no required skills specified
            }

            // Goal matching bonus (up to 24 points)
            if (!string.IsNullOrWhiteSpace(userGoal))
            {
                var titleDesc = $"{projectTitle} {projectDescription}".ToLowerInvariant();
                var goalNorm = userGoal.ToLowerInvariant();
                if ((goalNorm.Contains("хакатон") || goalNorm.Contains("hackathon")) && (titleDesc.Contains("хакатон") || titleDesc.Contains("hackathon")))
                {
                    score += 24.0;
                }
                else if ((goalNorm.Contains("опен") || goalNorm.Contains("open")) && (!string.IsNullOrWhiteSpace(projectRepo) || titleDesc.Contains("open source") || titleDesc.Contains("відкрит")))
                {
                    score += 24.0;
                }
                else if ((goalNorm.Contains("перш") || goalNorm.Contains("досвід") || goalNorm.Contains("first")) && (titleDesc.Contains("початк") || titleDesc.Contains("новач") || titleDesc.Contains("студент") || titleDesc.Contains("старт")))
                {
                    score += 24.0;
                }
                else if (goalNorm.Contains("проєкт") || goalNorm.Contains("project"))
                {
                    score += 18.0;
                }
                else
                {
                    score += 10.0;
                }
            }
            else
            {
                score += 10.0;
            }

            var finalScore = (int)Math.Min(99, Math.Max(25, Math.Round(score)));
            return finalScore;
        }

        // GET: api/projects
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectSummaryDto>>> GetOpenProjects(
            [FromQuery] string? search,
            [FromQuery] string? skill,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var currentUserId = GetCurrentUserId();

            var query = _db.TeamProjects
                .AsNoTracking()
                .Include(p => p.Members)
                .Where(p => p.IsLookingForMembers && p.Members.Count < p.MaxMembers);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(p => p.Title.ToLower().Contains(s) || p.Description.ToLower().Contains(s));
            }

            if (!string.IsNullOrWhiteSpace(skill))
            {
                var sk = skill.Trim().ToLower();
                query = query.Where(p => p.RequiredSkills.ToLower().Contains(sk));
            }

            var total = await query.CountAsync();
            var projects = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var creatorIds = projects.Select(p => p.CreatorId).Distinct().ToList();
            var creators = await _db.Users
                .AsNoTracking()
                .Where(u => creatorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            HashSet<string>? userSkills = null;
            string? userGoal = null;

            if (currentUserId.HasValue)
            {
                var currentUser = await _db.Users
                    .AsNoTracking()
                    .Include(u => u.Skills).ThenInclude(s => s.Skill)
                    .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

                if (currentUser != null && currentUser.Skills.Count > 0)
                {
                    userSkills = currentUser.Skills
                        .Where(s => s.Skill != null)
                        .Select(s => s.Skill.Name.Trim().ToLowerInvariant())
                        .ToHashSet();
                    userGoal = currentUser.Goal;
                }
            }

            var result = projects.Select(p =>
            {
                creators.TryGetValue(p.CreatorId, out var creator);
                var membership = currentUserId.HasValue
                    ? p.Members.FirstOrDefault(m => m.UserId == currentUserId.Value)
                    : null;

                var match = CalculateMatchScore(p.RequiredSkills, p.Title, p.Description, p.RepositoryUrl, userSkills, userGoal);

                return new ProjectSummaryDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    CreatedAt = p.CreatedAt,
                    MaxMembers = p.MaxMembers,
                    CurrentMembersCount = p.Members.Count,
                    IsLookingForMembers = p.IsLookingForMembers,
                    Status = p.Status.ToString(),
                    RequiredSkills = p.RequiredSkills,
                    RepositoryUrl = p.RepositoryUrl,
                    LogoUrl = p.LogoUrl,
                    MatchPercentage = match,
                    CreatorId = p.CreatorId,
                    CreatorNickname = creator?.Nickname ?? p.CreatedBy,
                    CreatorFullName = creator?.FullName ?? p.CreatedBy,
                    CreatorAvatarPath = creator?.AvatarPath,
                    IsUserMember = membership != null,
                    UserRole = membership?.Role
                };
            }).ToList();

            if (currentUserId.HasValue && string.IsNullOrWhiteSpace(search) && string.IsNullOrWhiteSpace(skill))
            {
                result = result.OrderByDescending(r => r.MatchPercentage ?? 0).ThenByDescending(r => r.CreatedAt).ToList();
            }

            return Ok(result);
        }

        // GET: api/projects/my
        [Authorize]
        [HttpGet("my")]
        public async Task<ActionResult<IEnumerable<ProjectSummaryDto>>> GetMyProjects()
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var myProjectIds = await _db.ProjectMemberships
                .AsNoTracking()
                .Where(m => m.UserId == userId.Value)
                .Select(m => m.TeamProjectId)
                .ToListAsync();

            var projects = await _db.TeamProjects
                .AsNoTracking()
                .Include(p => p.Members)
                .Where(p => myProjectIds.Contains(p.Id) || p.CreatorId == userId.Value)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var creatorIds = projects.Select(p => p.CreatorId).Distinct().ToList();
            var creators = await _db.Users
                .AsNoTracking()
                .Where(u => creatorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            var result = projects.Select(p =>
            {
                creators.TryGetValue(p.CreatorId, out var creator);
                var membership = p.Members.FirstOrDefault(m => m.UserId == userId.Value);

                return new ProjectSummaryDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    CreatedAt = p.CreatedAt,
                    MaxMembers = p.MaxMembers,
                    CurrentMembersCount = p.Members.Count,
                    IsLookingForMembers = p.IsLookingForMembers,
                    Status = p.Status.ToString(),
                    RequiredSkills = p.RequiredSkills,
                    RepositoryUrl = p.RepositoryUrl,
                    LogoUrl = p.LogoUrl,
                    CreatorId = p.CreatorId,
                    CreatorNickname = creator?.Nickname ?? p.CreatedBy,
                    CreatorFullName = creator?.FullName ?? p.CreatedBy,
                    CreatorAvatarPath = creator?.AvatarPath,
                    IsUserMember = membership != null,
                    UserRole = membership?.Role
                };
            }).ToList();

            return Ok(result);
        }

        // GET: api/projects/{id}
        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ProjectDetailsDto>> GetProjectDetails(Guid id)
        {
            var currentUserId = GetCurrentUserId();

            var project = await _db.TeamProjects
                .AsNoTracking()
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Проєкт не знайдено.");

            var isLeader = currentUserId.HasValue && project.CreatorId == currentUserId.Value;
            var currentMembership = currentUserId.HasValue
                ? project.Members.FirstOrDefault(m => m.UserId == currentUserId.Value)
                : null;

            var memberUserIds = project.Members.Select(m => m.UserId).Distinct().ToList();
            var memberUsers = await _db.Users
                .AsNoTracking()
                .Where(u => memberUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            var membersDto = project.Members.Select(m =>
            {
                memberUsers.TryGetValue(m.UserId, out var user);
                return new ProjectMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    FullName = user?.FullName ?? "Учасник",
                    Nickname = user?.Nickname ?? string.Empty,
                    AvatarPath = user?.AvatarPath,
                    Role = m.Role,
                    JoinedAt = m.JoinedAt,
                    IsLeader = m.UserId == project.CreatorId
                };
            }).OrderByDescending(m => m.IsLeader).ThenBy(m => m.JoinedAt).ToList();

            var pendingRequestsDto = new List<JoinRequestDto>();
            var hasPendingJoinRequest = false;

            if (currentUserId.HasValue)
            {
                hasPendingJoinRequest = await _db.ProjectJoinRequests
                    .AsNoTracking()
                    .AnyAsync(r => r.TeamProjectId == id && r.UserId == currentUserId.Value && r.Status == JoinRequestStatus.Pending);
            }

            if (isLeader)
            {
                var requests = await _db.ProjectJoinRequests
                    .AsNoTracking()
                    .Where(r => r.TeamProjectId == id && r.Status == JoinRequestStatus.Pending)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                var requestUserIds = requests.Select(r => r.UserId).Distinct().ToList();
                var requestUsers = await _db.Users
                    .AsNoTracking()
                    .Where(u => requestUserIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

                pendingRequestsDto = requests.Select(r =>
                {
                    requestUsers.TryGetValue(r.UserId, out var user);
                    return new JoinRequestDto
                    {
                        Id = r.Id,
                        UserId = r.UserId,
                        FullName = user?.FullName ?? "Кандидат",
                        Nickname = user?.Nickname ?? string.Empty,
                        AvatarPath = user?.AvatarPath,
                        CoverMessage = r.CoverMessage,
                        RequestedRole = r.RequestedRole,
                        Status = r.Status.ToString(),
                        CreatedAt = r.CreatedAt
                    };
                }).ToList();
            }

            int? matchPercentage = null;
            if (currentUserId.HasValue)
            {
                var currentUser = await _db.Users
                    .AsNoTracking()
                    .Include(u => u.Skills).ThenInclude(s => s.Skill)
                    .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

                if (currentUser != null && currentUser.Skills.Count > 0)
                {
                    var userSkills = currentUser.Skills
                        .Where(s => s.Skill != null)
                        .Select(s => s.Skill.Name.Trim().ToLowerInvariant())
                        .ToHashSet();
                    matchPercentage = CalculateMatchScore(project.RequiredSkills, project.Title, project.Description, project.RepositoryUrl, userSkills, currentUser.Goal);
                }
            }

            return Ok(new ProjectDetailsDto
            {
                Id = project.Id,
                Title = project.Title,
                Description = project.Description,
                CreatedAt = project.CreatedAt,
                MaxMembers = project.MaxMembers,
                IsLookingForMembers = project.IsLookingForMembers,
                Status = project.Status.ToString(),
                RequiredSkills = project.RequiredSkills,
                RepositoryUrl = project.RepositoryUrl,
                LogoUrl = project.LogoUrl,
                MatchPercentage = matchPercentage,
                CreatorId = project.CreatorId,
                IsUserLeader = isLeader,
                IsUserMember = currentMembership != null,
                UserRole = currentMembership?.Role,
                HasPendingJoinRequest = hasPendingJoinRequest,
                Members = membersDto,
                PendingRequests = pendingRequestsDto
            });
        }

        // POST: api/projects
        [Authorize]
        [HttpPost]
        public async Task<ActionResult<ProjectDetailsDto>> CreateProject([FromBody] CreateProjectDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var titleTrimmed = dto.Title.Trim();
            var titleLower = titleTrimmed.ToLowerInvariant();
            var duplicateExists = await _db.TeamProjects.AnyAsync(p => p.Title.ToLower() == titleLower);
            if (duplicateExists)
            {
                return BadRequest(new { message = $"Проєкт із назвою \"{titleTrimmed}\" вже існує. Будь ласка, оберіть іншу назву." });
            }

            var user = await _db.Users.FindAsync(userId.Value);
            if (user == null) return Unauthorized();

            var project = new TeamProject
            {
                Id = Guid.CreateVersion7(),
                Title = titleTrimmed,
                Description = dto.Description.Trim(),
                CreatedBy = $"{user.FirstName} {user.LastName}".Trim(),
                CreatorId = user.Id,
                CreatedAt = DateTime.UtcNow,
                MaxMembers = dto.MaxMembers,
                IsLookingForMembers = true,
                Status = ProjectStatus.Recruiting,
                RequiredSkills = dto.RequiredSkills?.Trim() ?? string.Empty,
                RepositoryUrl = dto.RepositoryUrl?.Trim() ?? string.Empty,
                LogoUrl = dto.LogoUrl?.Trim()
            };

            var leaderMembership = new ProjectMembership
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                TeamProjectId = project.Id,
                Role = string.IsNullOrWhiteSpace(dto.CreatorRole) ? "Team Lead" : dto.CreatorRole.Trim(),
                JoinedAt = DateTime.UtcNow
            };

            project.Members.Add(leaderMembership);

            _db.TeamProjects.Add(project);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProjectDetails), new { id = project.Id }, new ProjectDetailsDto
            {
                Id = project.Id,
                Title = project.Title,
                Description = project.Description,
                CreatedAt = project.CreatedAt,
                MaxMembers = project.MaxMembers,
                IsLookingForMembers = project.IsLookingForMembers,
                Status = project.Status.ToString(),
                RequiredSkills = project.RequiredSkills,
                RepositoryUrl = project.RepositoryUrl,
                LogoUrl = project.LogoUrl,
                CreatorId = project.CreatorId,
                IsUserLeader = true,
                IsUserMember = true,
                UserRole = leaderMembership.Role,
                Members = new List<ProjectMemberDto>
                {
                    new()
                    {
                        Id = leaderMembership.Id,
                        UserId = user.Id,
                        FullName = $"{user.FirstName} {user.LastName}".Trim(),
                        Nickname = user.Nickname,
                        AvatarPath = user.AvatarPath,
                        Role = leaderMembership.Role,
                        JoinedAt = leaderMembership.JoinedAt,
                        IsLeader = true
                    }
                }
            });
        }

        // PUT: api/projects/{id}
        [Authorize]
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] UpdateProjectDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects.Include(p => p.Members).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid();
            }

            var titleTrimmed = dto.Title.Trim();
            var titleLower = titleTrimmed.ToLowerInvariant();
            var duplicateExists = await _db.TeamProjects.AnyAsync(p => p.Id != id && p.Title.ToLower() == titleLower);
            if (duplicateExists)
            {
                return BadRequest(new { message = $"Проєкт із назвою \"{titleTrimmed}\" вже існує. Будь ласка, оберіть іншу назву." });
            }

            project.Title = titleTrimmed;
            project.Description = dto.Description.Trim();
            project.MaxMembers = Math.Max(project.Members.Count, dto.MaxMembers);
            project.RequiredSkills = dto.RequiredSkills?.Trim() ?? string.Empty;

            // Preserve repository URL if not provided in payload (Item 17)
            if (dto.RepositoryUrl != null)
            {
                project.RepositoryUrl = dto.RepositoryUrl.Trim();
            }

            if (dto.LogoUrl != null)
            {
                project.LogoUrl = dto.LogoUrl.Trim();
            }

            project.IsLookingForMembers = dto.IsLookingForMembers && project.Members.Count < project.MaxMembers;

            if (Enum.TryParse<ProjectStatus>(dto.Status, true, out var parsedStatus))
            {
                project.Status = parsedStatus;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/projects/{id}/join
        [Authorize]
        [HttpPost("{id:guid}/join")]
        public async Task<IActionResult> SubmitJoinRequest(Guid id, [FromBody] CreateJoinRequestDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Проєкт не знайдено.");

            if (!project.IsLookingForMembers || project.Members.Count >= project.MaxMembers)
            {
                return BadRequest("У цій команді наразі немає відкритих місць.");
            }

            var isAlreadyMember = project.Members.Any(m => m.UserId == userId.Value);
            if (isAlreadyMember)
            {
                return BadRequest("Ви вже є учасником цієї команди.");
            }

            var existingPending = await _db.ProjectJoinRequests
                .AnyAsync(r => r.TeamProjectId == id && r.UserId == userId.Value && r.Status == JoinRequestStatus.Pending);

            if (existingPending)
            {
                return BadRequest("Ваша заявка вже очікує на розгляд лідером команди.");
            }

            var request = new ProjectJoinRequest
            {
                Id = Guid.CreateVersion7(),
                TeamProjectId = id,
                UserId = userId.Value,
                CoverMessage = dto.CoverMessage?.Trim() ?? string.Empty,
                RequestedRole = string.IsNullOrWhiteSpace(dto.RequestedRole) ? "Developer" : dto.RequestedRole.Trim(),
                Status = JoinRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.ProjectJoinRequests.Add(request);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Заявку успішно надіслано!", requestId = request.Id });
        }

        // GET: api/projects/{id}/requests
        [Authorize]
        [HttpGet("{id:guid}/requests")]
        public async Task<ActionResult<IEnumerable<JoinRequestDto>>> GetPendingRequests(Guid id)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid();
            }

            var requests = await _db.ProjectJoinRequests
                .AsNoTracking()
                .Where(r => r.TeamProjectId == id && r.Status == JoinRequestStatus.Pending)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var userIds = requests.Select(r => r.UserId).Distinct().ToList();
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath });

            var result = requests.Select(r =>
            {
                users.TryGetValue(r.UserId, out var u);
                return new JoinRequestDto
                {
                    Id = r.Id,
                    UserId = r.UserId,
                    FullName = u?.FullName ?? "Кандидат",
                    Nickname = u?.Nickname ?? string.Empty,
                    AvatarPath = u?.AvatarPath,
                    CoverMessage = r.CoverMessage,
                    RequestedRole = r.RequestedRole,
                    Status = r.Status.ToString(),
                    CreatedAt = r.CreatedAt
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/projects/{id}/requests/{requestId}/respond
        [Authorize]
        [HttpPost("{id:guid}/requests/{requestId:guid}/respond")]
        public async Task<IActionResult> RespondToJoinRequest(Guid id, Guid requestId, [FromBody] RespondJoinRequestDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid();
            }

            var request = await _db.ProjectJoinRequests
                .FirstOrDefaultAsync(r => r.Id == requestId && r.TeamProjectId == id);

            if (request == null) return NotFound("Заявку не знайдено.");

            if (request.Status != JoinRequestStatus.Pending)
            {
                return BadRequest("На цю заявку вже надано відповідь.");
            }

            request.RespondedAt = DateTime.UtcNow;

            if (dto.Accept)
            {
                if (project.Members.Count >= project.MaxMembers)
                {
                    return BadRequest("У команді вже досягнуто максимальної кількості учасників.");
                }

                request.Status = JoinRequestStatus.Accepted;

                var newMembership = new ProjectMembership
                {
                    Id = Guid.CreateVersion7(),
                    UserId = request.UserId,
                    TeamProjectId = id,
                    Role = !string.IsNullOrWhiteSpace(dto.AssignedRole)
                        ? dto.AssignedRole.Trim()
                        : request.RequestedRole,
                    JoinedAt = DateTime.UtcNow
                };

                _db.ProjectMemberships.Add(newMembership);

                if (project.Members.Count + 1 >= project.MaxMembers)
                {
                    project.IsLookingForMembers = false;
                }
            }
            else
            {
                request.Status = JoinRequestStatus.Rejected;
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = dto.Accept ? "Учасника додано до команди!" : "Заявку відхилено." });
        }

        // DELETE: api/projects/{id}/members/{memberId}
        [Authorize]
        [HttpDelete("{id:guid}/members/{memberId:guid}")]
        public async Task<IActionResult> RemoveMember(Guid id, Guid memberId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Проєкт не знайдено.");

            var membership = project.Members.FirstOrDefault(m => m.Id == memberId);
            if (membership == null) return NotFound("Учасника не знайдено.");

            var isLeader = project.CreatorId == userId.Value;
            var isSelf = membership.UserId == userId.Value;

            if (!isLeader && !isSelf)
            {
                return Forbid();
            }

            if (membership.UserId == project.CreatorId)
            {
                return BadRequest("Творець команди не може покинути команду. Передайте лідерство або видаліть проєкт.");
            }

            _db.ProjectMemberships.Remove(membership);

            if (project.Members.Count - 1 < project.MaxMembers)
            {
                project.IsLookingForMembers = true;
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = isSelf ? "Ви вийшли з команди." : "Учасника вилучено з команди." });
        }

        // POST: api/projects/{id}/logo
        [Authorize]
        [HttpPost("{id:guid}/logo")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<object>> UploadProjectLogo(Guid id, IFormFile file)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects.FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid("Лише творець або лідер команди може завантажувати логотип.");
            }

            var (path, error) = await _logoStorage.SaveAsync(project.Id, file);
            if (error != null)
            {
                return BadRequest(new { message = error });
            }

            project.LogoUrl = path;
            await _db.SaveChangesAsync();

            return Ok(new { logoUrl = path, message = "Логотип команди успішно оновлено!" });
        }

        // DELETE: api/projects/{id}/logo
        [Authorize]
        [HttpDelete("{id:guid}/logo")]
        public async Task<IActionResult> DeleteProjectLogo(Guid id)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects.FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid("Лише творець або лідер команди може видаляти логотип.");
            }

            _logoStorage.Delete(project.LogoUrl);
            project.LogoUrl = null;
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }
}
