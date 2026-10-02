using System;
using System.Security.Claims;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Hubs;
using LinqUp.API.Services;
using LinqUp.Shared.Dtos.Meetings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Authorize]
    [Route("api/projects/{projectId:guid}/[controller]")]
    [ApiController]
    public class MeetingsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILiveKitMeetingService _meetingService;
        private readonly IHubContext<TeamChatHub> _hubContext;

        public MeetingsController(
            AppDbContext db,
            ILiveKitMeetingService meetingService,
            IHubContext<TeamChatHub> hubContext)
        {
            _db = db;
            _meetingService = meetingService;
            _hubContext = hubContext;
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

        // POST: api/projects/{projectId}/meetings/token
        [HttpPost("token")]
        public async Task<ActionResult<MeetingTokenResponseDto>> GetMeetingToken(
            Guid projectId,
            [FromBody] MeetingTokenRequestDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid("Лише учасники команди мають доступ до відеозустрічей.");
            }

            var user = await _db.Users.FindAsync(userId.Value);
            if (user == null) return Unauthorized();

            var response = await _meetingService.CreateOrJoinMeetingAsync(
                projectId,
                dto.RoomName,
                dto.MeetingTitle,
                user);

            var groupName = $"Team_{projectId:N}";
            await _hubContext.Clients.Group(groupName).SendAsync("MeetingActiveState", new
            {
                ProjectId = projectId,
                RoomName = response.RoomName,
                HostNickname = user.Nickname,
                HostFullName = $"{user.FirstName} {user.LastName}".Trim(),
                StartedAt = DateTime.UtcNow,
                IsActive = true
            });

            return Ok(response);
        }

        // GET: api/projects/{projectId}/meetings/active
        [HttpGet("active")]
        public async Task<ActionResult<ActiveMeetingDto?>> GetActiveMeeting(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            var activeMeeting = await _meetingService.GetActiveMeetingAsync(projectId);
            return Ok(activeMeeting);
        }

        // POST: api/projects/{projectId}/meetings/end
        [HttpPost("end")]
        public async Task<IActionResult> EndMeeting(Guid projectId)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await IsProjectMemberAsync(projectId, userId.Value))
            {
                return Forbid();
            }

            var ended = await _meetingService.EndMeetingAsync(projectId, userId.Value);

            if (ended)
            {
                var groupName = $"Team_{projectId:N}";
                await _hubContext.Clients.Group(groupName).SendAsync("MeetingEnded", new
                {
                    ProjectId = projectId
                });
            }

            return Ok(new { success = ended });
        }
    }
}
