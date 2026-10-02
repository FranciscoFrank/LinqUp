using System.Text.RegularExpressions;
using LinqUp.API.Data;
using LinqUp.API.Entities;
using LinqUp.Shared.Dtos.Profile;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LinqUp.API.Identity;

namespace LinqUp.API.Services
{
    public class ProfileService : IProfileService
    {
        private static readonly Regex NicknamePattern = new("^[a-z0-9_]{3,20}$", RegexOptions.Compiled);

        private readonly AppDbContext _db;
        private readonly IAvatarStorageService _avatarStorage;

        public ProfileService(AppDbContext db, IAvatarStorageService avatarStorage)
        {
            _db = db;
            _avatarStorage = avatarStorage;
        }

        public async Task<(ProfileDto? Profile, string? Error)> GetMeAsync(Guid userId)
        {
            var user = await LoadUserWithDetailsAsync(userId);
            if (user is null) return (null, "User not found");
            return (ToProfileDto(user), null);
        }

        public async Task<(ProfileDto? Profile, string? Error)> UpdateMeAsync(Guid userId, UpdateProfileRequest request)
        {
            var user = await LoadUserWithDetailsAsync(userId);
            if (user is null) return (null, "User not found");

            var normalizedNickname = request.Nickname.Trim().ToLowerInvariant();
            if (!NicknamePattern.IsMatch(normalizedNickname))
            {
                return (null, "Нікнейм має містити 3-20 символів: латинські літери, цифри або '_'.");
            }

            var taken = await _db.Users.AnyAsync(u => u.Nickname == normalizedNickname && u.Id != user.Id);
            if (taken)
            {
                return (null, "Цей нікнейм вже зайнятий.");
            }

            user.FirstName = request.FirstName.Trim();
            user.LastName = request.LastName.Trim();
            user.Nickname = normalizedNickname;
            user.Bio = request.Bio.Trim();
            user.IsOpenToWork = request.IsOpenToWork;
            user.Goal = request.Goal?.Trim();

            await _db.SaveChangesAsync();
            return (ToProfileDto(user), null);
        }

        public async Task<bool> IsNicknameAvailableAsync(string nickname)
        {
            var normalized = (nickname ?? string.Empty).Trim().ToLowerInvariant();
            if (!NicknamePattern.IsMatch(normalized))
            {
                return false;
            }

            var taken = await _db.Users.AnyAsync(u => u.Nickname == normalized);
            return !taken;
        }

        public async Task<(PublicProfileDto? Profile, string? Error)> GetByNicknameAsync(string nickname)
        {
            var normalized = nickname.Trim().ToLowerInvariant();
            var user = await _db.Users
                .Include(u => u.ContactMethods)
                .Include(u => u.Skills).ThenInclude(s => s.Skill)
                .FirstOrDefaultAsync(u => u.Nickname == normalized);

            if (user is null) return (null, "User not found");

            return (new PublicProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Nickname = user.Nickname,
                Bio = user.Bio,
                AvatarUrl = user.AvatarPath,
                IsOpenToWork = user.IsOpenToWork,
                Goal = user.Goal,
                ContactMethods = user.ContactMethods.Select(ToContactDto).ToList(),
                Skills = user.Skills.Select(ToSkillDto).ToList()
            }, null);
        }

        public async Task<(ProfileDto? Profile, string? Error)> UploadAvatarAsync(Guid userId, IFormFile file)
        {
            var user = await LoadUserWithDetailsAsync(userId);
            if (user is null) return (null, "User not found");

            var (path, error) = await _avatarStorage.SaveAsync(user.Id, file);
            if (error is not null) return (null, error);

            if (!string.IsNullOrEmpty(user.AvatarPath))
            {
                _avatarStorage.Delete(user.AvatarPath);
            }
            
            user.AvatarPath = path;
            await _db.SaveChangesAsync();

            return (ToProfileDto(user), null);
        }

        public async Task<(bool Success, string? Error)> DeleteAvatarAsync(Guid userId)
        {
            var user = await LoadUserWithDetailsAsync(userId);
            if (user is null) return (false, "User not found");

            if (!string.IsNullOrEmpty(user.AvatarPath))
            {
                _avatarStorage.Delete(user.AvatarPath);
                user.AvatarPath = null;
                await _db.SaveChangesAsync();
            }

            return (true, null);
        }

        public async Task<(ContactMethodDto? Contact, string? Error)> AddContactAsync(Guid userId, AddContactMethodRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Value))
            {
                return (null, "Значення контакту обов'язкове.");
            }

            var contact = new ContactMethod
            {
                UserId = userId,
                Type = request.Type,
                Value = request.Value.Trim(),
                IsPrimary = request.IsPrimary
            };

            _db.ContactMethods.Add(contact);
            await _db.SaveChangesAsync();

            return (ToContactDto(contact), null);
        }

        public async Task<(ContactMethodDto? Contact, string? Error)> UpdateContactAsync(Guid userId, Guid contactId, AddContactMethodRequest request)
        {
            var contact = await _db.ContactMethods.FirstOrDefaultAsync(c => c.Id == contactId && c.UserId == userId);
            if (contact is null) return (null, "Contact not found");

            contact.Type = request.Type;
            contact.Value = request.Value.Trim();
            contact.IsPrimary = request.IsPrimary;
            await _db.SaveChangesAsync();

            return (ToContactDto(contact), null);
        }

        public async Task<(bool Success, string? Error)> DeleteContactAsync(Guid userId, Guid contactId)
        {
            var contact = await _db.ContactMethods.FirstOrDefaultAsync(c => c.Id == contactId && c.UserId == userId);
            if (contact is null) return (false, "Contact not found");

            _db.ContactMethods.Remove(contact);
            await _db.SaveChangesAsync();
            return (true, null);
        }

        public async Task<(List<UserSkillDto>? Skills, string? Error)> GetMySkillsAsync(Guid userId)
        {
            var skills = await _db.UserSkills
                .Include(s => s.Skill)
                .Where(s => s.UserId == userId)
                .ToListAsync();

            return (skills.Select(ToSkillDto).ToList(), null);
        }

        public async Task<(UserSkillDto? Skill, string? Error)> AddSkillAsync(Guid userId, AddUserSkillRequest request)
        {
            Skill? skill = null;

            if (request.SkillId.HasValue)
            {
                skill = await _db.Skills.FindAsync(request.SkillId.Value);
            }
            else if (!string.IsNullOrWhiteSpace(request.SkillName))
            {
                var name = request.SkillName.Trim();
                skill = await _db.Skills.FirstOrDefaultAsync(s => s.Name.ToLower() == name.ToLower());
                if (skill is null)
                {
                    skill = new Skill { Name = name, IsPreset = false };
                    _db.Skills.Add(skill);
                    await _db.SaveChangesAsync();
                }
            }

            if (skill is null)
            {
                return (null, "Вкажіть skillId або назву навички.");
            }

            var already = await _db.UserSkills.AnyAsync(us => us.UserId == userId && us.SkillId == skill.Id);
            if (already)
            {
                return (null, "Ця навичка вже додана до профілю.");
            }

            var userSkill = new UserSkill
            {
                UserId = userId,
                SkillId = skill.Id,
                ExperienceMonths = request.ExperienceMonths
            };

            _db.UserSkills.Add(userSkill);
            await _db.SaveChangesAsync();

            userSkill.Skill = skill;
            return (ToSkillDto(userSkill), null);
        }

        public async Task<(UserSkillDto? Skill, string? Error)> UpdateSkillAsync(Guid userId, Guid skillId, UpdateUserSkillRequest request)
        {
            var userSkill = await _db.UserSkills
                .Include(s => s.Skill)
                .FirstOrDefaultAsync(s => s.Id == skillId && s.UserId == userId);

            if (userSkill is null) return (null, "Skill not found");

            userSkill.ExperienceMonths = request.ExperienceMonths;
            await _db.SaveChangesAsync();

            return (ToSkillDto(userSkill), null);
        }

        public async Task<(bool Success, string? Error)> DeleteSkillAsync(Guid userId, Guid skillId)
        {
            var userSkill = await _db.UserSkills.FirstOrDefaultAsync(s => s.Id == skillId && s.UserId == userId);
            if (userSkill is null) return (false, "Skill not found");

            _db.UserSkills.Remove(userSkill);
            await _db.SaveChangesAsync();
            return (true, null);
        }

        private async Task<ApplicationUser?> LoadUserWithDetailsAsync(Guid userId) =>
            await _db.Users
                .Include(u => u.ContactMethods)
                .Include(u => u.Skills).ThenInclude(s => s.Skill)
                .FirstOrDefaultAsync(u => u.Id == userId);

        private static ProfileDto ToProfileDto(ApplicationUser user) => new()
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Nickname = user.Nickname,
            Bio = user.Bio,
            AvatarUrl = user.AvatarPath,
            TwoFactorEnabled = user.TwoFactorEnabled,
            IsOpenToWork = user.IsOpenToWork,
            Goal = user.Goal,
            CreatedAt = user.CreatedAt,
            ContactMethods = user.ContactMethods.Select(ToContactDto).ToList(),
            Skills = user.Skills.Select(ToSkillDto).ToList()
        };

        private static ContactMethodDto ToContactDto(ContactMethod contact) => new()
        {
            Id = contact.Id,
            Type = contact.Type,
            Value = contact.Value,
            IsPrimary = contact.IsPrimary
        };

        private static UserSkillDto ToSkillDto(UserSkill userSkill) => new()
        {
            Id = userSkill.Id,
            SkillId = userSkill.SkillId,
            SkillName = userSkill.Skill?.Name ?? string.Empty,
            ExperienceMonths = userSkill.ExperienceMonths
        };
    }
}
