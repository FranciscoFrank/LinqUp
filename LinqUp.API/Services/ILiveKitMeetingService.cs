using System;
using System.Threading.Tasks;
using LinqUp.API.Identity;
using LinqUp.Shared.Dtos.Meetings;

namespace LinqUp.API.Services
{
    public interface ILiveKitMeetingService
    {
        Task<MeetingTokenResponseDto> CreateOrJoinMeetingAsync(Guid projectId, string? roomName, string? title, ApplicationUser user);
        Task<ActiveMeetingDto?> GetActiveMeetingAsync(Guid projectId);
        Task<bool> EndMeetingAsync(Guid projectId, Guid userId);
    }
}
