using LinqUp.Shared.Dtos.Profile;
using Microsoft.AspNetCore.Http;

namespace LinqUp.API.Services
{
    public interface IProfileService
    {
        Task<(ProfileDto? Profile, string? Error)> GetMeAsync(Guid userId);
        Task<(ProfileDto? Profile, string? Error)> UpdateMeAsync(Guid userId, UpdateProfileRequest request);
        Task<bool> IsNicknameAvailableAsync(string nickname);
        Task<(PublicProfileDto? Profile, string? Error)> GetByNicknameAsync(string nickname);
        
        Task<(ProfileDto? Profile, string? Error)> UploadAvatarAsync(Guid userId, IFormFile file);
        Task<(bool Success, string? Error)> DeleteAvatarAsync(Guid userId);

        Task<(ContactMethodDto? Contact, string? Error)> AddContactAsync(Guid userId, AddContactMethodRequest request);
        Task<(ContactMethodDto? Contact, string? Error)> UpdateContactAsync(Guid userId, Guid contactId, AddContactMethodRequest request);
        Task<(bool Success, string? Error)> DeleteContactAsync(Guid userId, Guid contactId);

        Task<(List<UserSkillDto>? Skills, string? Error)> GetMySkillsAsync(Guid userId);
        Task<(UserSkillDto? Skill, string? Error)> AddSkillAsync(Guid userId, AddUserSkillRequest request);
        Task<(UserSkillDto? Skill, string? Error)> UpdateSkillAsync(Guid userId, Guid skillId, UpdateUserSkillRequest request);
        Task<(bool Success, string? Error)> DeleteSkillAsync(Guid userId, Guid skillId);
    }
}
