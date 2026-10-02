using System;
using System.Text.Json;
using System.Threading.Tasks;
using Livekit.Server.Sdk.Dotnet;
using LinqUp.API.Data;
using LinqUp.API.Entities;
using LinqUp.API.Identity;
using LinqUp.Shared.Dtos.Meetings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LinqUp.API.Services
{
    public class LiveKitMeetingService : ILiveKitMeetingService
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _db;
        private readonly ILogger<LiveKitMeetingService> _logger;

        public LiveKitMeetingService(
            IConfiguration config,
            AppDbContext db,
            ILogger<LiveKitMeetingService> logger)
        {
            _config = config;
            _db = db;
            _logger = logger;
        }

        public async Task<MeetingTokenResponseDto> CreateOrJoinMeetingAsync(
            Guid projectId,
            string? roomName,
            string? title,
            ApplicationUser user)
        {
            var effectiveRoomName = !string.IsNullOrWhiteSpace(roomName)
                ? roomName.Trim()
                : $"linqup-{projectId:N}";

            var liveKitUrl = _config["LiveKit:Url"] ?? "wss://linqup.livekit.cloud";
            var apiKey = _config["LiveKit:ApiKey"];
            var apiSecret = _config["LiveKit:ApiSecret"];

            var isConfigured = !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(apiSecret);
            string token = string.Empty;

            if (isConfigured)
            {
                try
                {
                    var accessToken = new AccessToken(apiKey, apiSecret)
                        .WithIdentity(user.Id.ToString())
                        .WithName($"{user.FirstName} {user.LastName}".Trim())
                        .WithGrants(new VideoGrants
                        {
                            RoomJoin = true,
                            Room = effectiveRoomName,
                            CanPublish = true,
                            CanSubscribe = true,
                            CanPublishData = true
                        })
                        .WithMetadata(JsonSerializer.Serialize(new
                        {
                            nickname = user.Nickname,
                            avatar = user.AvatarPath
                        }))
                        .WithTtl(TimeSpan.FromHours(6));

                    token = accessToken.ToJwt();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to generate LiveKit token via SDK. Falling back to local token.");
                }
            }

            // Fallback token if LiveKit keys are not configured or failed
            if (string.IsNullOrWhiteSpace(token))
            {
                var fallbackKey = "devkey";
                var fallbackSecret = "secret012345678901234567890123456789";
                try
                {
                    var devToken = new AccessToken(fallbackKey, fallbackSecret)
                        .WithIdentity(user.Id.ToString())
                        .WithName($"{user.FirstName} {user.LastName}".Trim())
                        .WithGrants(new VideoGrants
                        {
                            RoomJoin = true,
                            Room = effectiveRoomName,
                            CanPublish = true,
                            CanSubscribe = true,
                            CanPublishData = true
                        })
                        .WithTtl(TimeSpan.FromHours(6));

                    token = devToken.ToJwt();
                }
                catch
                {
                    // Basic base64 payload token as ultimate fallback
                    token = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{user.Id}:{user.Nickname}:{effectiveRoomName}"));
                }
            }

            // Record or activate meeting in DB
            var activeMeeting = await _db.ProjectMeetings
                .FirstOrDefaultAsync(m => m.TeamProjectId == projectId && m.RoomName == effectiveRoomName && m.IsActive);

            if (activeMeeting == null)
            {
                activeMeeting = new ProjectMeeting
                {
                    Id = Guid.CreateVersion7(),
                    TeamProjectId = projectId,
                    RoomName = effectiveRoomName,
                    Title = string.IsNullOrWhiteSpace(title) ? "Командна відеозустріч" : title.Trim(),
                    HostUserId = user.Id,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };
                _db.ProjectMeetings.Add(activeMeeting);
                await _db.SaveChangesAsync();
            }

            return new MeetingTokenResponseDto
            {
                Token = token,
                ServerUrl = liveKitUrl,
                RoomName = effectiveRoomName,
                ParticipantIdentity = user.Id.ToString(),
                ParticipantName = $"{user.FirstName} {user.LastName}".Trim(),
                IsLiveKitConfigured = isConfigured
            };
        }

        public async Task<ActiveMeetingDto?> GetActiveMeetingAsync(Guid projectId)
        {
            var meeting = await _db.ProjectMeetings
                .AsNoTracking()
                .Where(m => m.TeamProjectId == projectId && m.IsActive)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            if (meeting == null) return null;

            var host = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == meeting.HostUserId)
                .Select(u => new { u.Nickname, FullName = $"{u.FirstName} {u.LastName}".Trim(), u.AvatarPath })
                .FirstOrDefaultAsync();

            return new ActiveMeetingDto
            {
                Id = meeting.Id,
                TeamProjectId = meeting.TeamProjectId,
                RoomName = meeting.RoomName,
                Title = meeting.Title,
                HostUserId = meeting.HostUserId,
                HostNickname = host?.Nickname ?? "Host",
                HostFullName = host?.FullName ?? "Host",
                HostAvatarPath = host?.AvatarPath,
                StartedAt = meeting.CreatedAt,
                IsActive = meeting.IsActive
            };
        }

        public async Task<bool> EndMeetingAsync(Guid projectId, Guid userId)
        {
            var activeMeeting = await _db.ProjectMeetings
                .FirstOrDefaultAsync(m => m.TeamProjectId == projectId && m.IsActive);

            if (activeMeeting == null) return false;

            activeMeeting.IsActive = false;
            activeMeeting.EndedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return true;
        }
    }
}
