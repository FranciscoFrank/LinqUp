using System;
using System.ComponentModel.DataAnnotations;

namespace LinqUp.Shared.Dtos.Meetings
{
    public class MeetingTokenRequestDto
    {
        public string? RoomName { get; set; }
        public string? MeetingTitle { get; set; }
    }

    public class MeetingTokenResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string ServerUrl { get; set; } = string.Empty;
        public string RoomName { get; set; } = string.Empty;
        public string ParticipantIdentity { get; set; } = string.Empty;
        public string ParticipantName { get; set; } = string.Empty;
        public bool IsLiveKitConfigured { get; set; }
    }

    public class ActiveMeetingDto
    {
        public Guid Id { get; set; }
        public Guid TeamProjectId { get; set; }
        public string RoomName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public Guid HostUserId { get; set; }
        public string HostNickname { get; set; } = string.Empty;
        public string HostFullName { get; set; } = string.Empty;
        public string? HostAvatarPath { get; set; }
        public DateTime StartedAt { get; set; }
        public bool IsActive { get; set; }
    }
}
