using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.Shared;
using LinqUp.Shared.Dtos.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Route("api/projects/{projectId:guid}/tasks")]
    [ApiController]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _db;

        public TasksController(AppDbContext db)
        {
            _db = db;
        }

        private Guid? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }

        private async Task<bool> IsProjectMember(Guid projectId, Guid userId)
        {
            return await _db.ProjectMemberships
                .AnyAsync(m => m.TeamProjectId == projectId && m.UserId == userId);
        }

        // GET: api/projects/{projectId}/tasks
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectTaskDto>>> GetProjectTasks(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMember(projectId, userId.Value))
            {
                var project = await _db.TeamProjects.FindAsync(projectId);
                if (project == null) return NotFound();
                if (project.CreatorId != userId.Value)
                    return Forbid("You must be a member of the project to view tasks.");
            }

            var tasks = await _db.ProjectTasks
                .AsNoTracking()
                .Where(t => t.TeamProjectId == projectId)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var userIds = tasks.Where(t => t.AssigneeId.HasValue).Select(t => t.AssigneeId!.Value).Distinct().ToList();
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => new { u.Nickname, u.AvatarPath });

            var result = tasks.Select(t =>
            {
                var hasAssignee = t.AssigneeId.HasValue && users.TryGetValue(t.AssigneeId.Value, out var assignee);
                return new ProjectTaskDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    Status = t.Status,
                    AssigneeId = t.AssigneeId,
                    AssigneeNickname = hasAssignee ? users[t.AssigneeId!.Value].Nickname : null,
                    AssigneeAvatarPath = hasAssignee ? users[t.AssigneeId!.Value].AvatarPath : null,
                    CreatorId = t.CreatorId,
                    CreatedAt = t.CreatedAt
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/projects/{projectId}/tasks
        [HttpPost]
        public async Task<ActionResult<ProjectTaskDto>> CreateTask(Guid projectId, [FromBody] CreateProjectTaskDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMember(projectId, userId.Value))
            {
                var p = await _db.TeamProjects.FindAsync(projectId);
                if (p == null) return NotFound();
                if (p.CreatorId != userId.Value)
                    return Forbid("You must be a member of the project to create tasks.");
            }

            var task = new ProjectTask
            {
                Id = Guid.CreateVersion7(),
                TeamProjectId = projectId,
                Title = dto.Title.Trim(),
                Description = dto.Description?.Trim() ?? string.Empty,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "Todo" : dto.Status,
                AssigneeId = dto.AssigneeId,
                CreatorId = userId.Value,
                CreatedAt = DateTime.UtcNow
            };

            _db.ProjectTasks.Add(task);
            await _db.SaveChangesAsync();

            string? assigneeNickname = null;
            string? assigneeAvatarPath = null;
            if (task.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(task.AssigneeId.Value);
                assigneeNickname = assignee?.Nickname;
                assigneeAvatarPath = assignee?.AvatarPath;
            }

            return Ok(new ProjectTaskDto
            {
                Id = task.Id,
                Title = task.Title,
                Description = task.Description,
                Status = task.Status,
                AssigneeId = task.AssigneeId,
                AssigneeNickname = assigneeNickname,
                AssigneeAvatarPath = assigneeAvatarPath,
                CreatorId = task.CreatorId,
                CreatedAt = task.CreatedAt
            });
        }

        // PUT: api/projects/{projectId}/tasks/{id}
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateTask(Guid projectId, Guid id, [FromBody] CreateProjectTaskDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMember(projectId, userId.Value))
            {
                var p = await _db.TeamProjects.FindAsync(projectId);
                if (p == null) return NotFound();
                if (p.CreatorId != userId.Value)
                    return Forbid("You must be a member of the project to update tasks.");
            }

            var task = await _db.ProjectTasks.FirstOrDefaultAsync(t => t.Id == id && t.TeamProjectId == projectId);
            if (task == null) return NotFound();

            task.Title = dto.Title.Trim();
            task.Description = dto.Description?.Trim() ?? string.Empty;
            task.Status = string.IsNullOrWhiteSpace(dto.Status) ? "Todo" : dto.Status;
            task.AssigneeId = dto.AssigneeId;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/projects/{projectId}/tasks/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteTask(Guid projectId, Guid id)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMember(projectId, userId.Value))
            {
                var p = await _db.TeamProjects.FindAsync(projectId);
                if (p == null) return NotFound();
                if (p.CreatorId != userId.Value)
                    return Forbid("You must be a member of the project to delete tasks.");
            }

            var task = await _db.ProjectTasks.FirstOrDefaultAsync(t => t.Id == id && t.TeamProjectId == projectId);
            if (task == null) return NotFound();

            _db.ProjectTasks.Remove(task);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
