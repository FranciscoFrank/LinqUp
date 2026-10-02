using LinqUp.API.Data;
using LinqUp.API.Entities;
using LinqUp.API.Services;
using LinqUp.Shared.Dtos.Profile;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Route("api/profile")]
    [ApiController]
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService _profileService;
        private readonly AppDbContext _db;

        public ProfileController(IProfileService profileService, AppDbContext db)
        {
            _profileService = profileService;
            _db = db;
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<ProfileDto>> GetMe()
        {
            var (profile, error) = await _profileService.GetMeAsync(CurrentUserId());
            if (error is not null || profile is null)
                return Unauthorized();

            return Ok(profile);
        }

        [HttpPut("me")]
        [Authorize]
        public async Task<ActionResult<ProfileDto>> UpdateMe([FromBody] UpdateProfileRequest request)
        {
            var (profile, error) = await _profileService.UpdateMeAsync(CurrentUserId(), request);
            if (error is not null)
            {
                if (error == "User not found") return Unauthorized();
                if (error == "Цей нікнейм вже зайнятий.") return Conflict(error);
                return BadRequest(error);
            }

            return Ok(profile!);
        }

        [HttpGet("nickname-available")]
        public async Task<ActionResult<bool>> IsNicknameAvailable([FromQuery] string value)
        {
            var available = await _profileService.IsNicknameAvailableAsync(value);
            return Ok(available);
        }

        [HttpGet("{nickname}")]
        public async Task<ActionResult<PublicProfileDto>> GetByNickname(string nickname)
        {
            var (profile, error) = await _profileService.GetByNicknameAsync(nickname);
            if (error is not null || profile is null)
                return NotFound();

            return Ok(profile);
        }

        [HttpPost("avatar")]
        [Authorize]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<ProfileDto>> UploadAvatar(IFormFile file)
        {
            var (profile, error) = await _profileService.UploadAvatarAsync(CurrentUserId(), file);
            if (error is not null)
            {
                if (error == "User not found") return Unauthorized();
                return BadRequest(error);
            }

            return Ok(profile!);
        }

        [HttpDelete("avatar")]
        [Authorize]
        public async Task<IActionResult> DeleteAvatar()
        {
            var (success, error) = await _profileService.DeleteAvatarAsync(CurrentUserId());
            if (!success)
            {
                if (error == "User not found") return Unauthorized();
                return BadRequest(error);
            }

            return NoContent();
        }

        [HttpPost("contacts")]
        [Authorize]
        public async Task<ActionResult<ContactMethodDto>> AddContact([FromBody] AddContactMethodRequest request)
        {
            var (contact, error) = await _profileService.AddContactAsync(CurrentUserId(), request);
            if (error is not null || contact is null)
                return BadRequest(error);

            return StatusCode(StatusCodes.Status201Created, contact);
        }

        [HttpPut("contacts/{id:guid}")]
        [Authorize]
        public async Task<ActionResult<ContactMethodDto>> UpdateContact(Guid id, [FromBody] AddContactMethodRequest request)
        {
            var (contact, error) = await _profileService.UpdateContactAsync(CurrentUserId(), id, request);
            if (error is not null || contact is null)
                return NotFound();

            return Ok(contact);
        }

        [HttpDelete("contacts/{id:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteContact(Guid id)
        {
            var (success, _) = await _profileService.DeleteContactAsync(CurrentUserId(), id);
            if (!success)
                return NotFound();

            return NoContent();
        }

        [HttpGet("skills")]
        [Authorize]
        public async Task<ActionResult<List<UserSkillDto>>> GetMySkills()
        {
            var (skills, _) = await _profileService.GetMySkillsAsync(CurrentUserId());
            return Ok(skills ?? new List<UserSkillDto>());
        }

        [HttpPost("skills")]
        [Authorize]
        public async Task<ActionResult<UserSkillDto>> AddSkill([FromBody] AddUserSkillRequest request)
        {
            var (skill, error) = await _profileService.AddSkillAsync(CurrentUserId(), request);
            if (error is not null || skill is null)
            {
                if (error == "Ця навичка вже додана до профілю.") return Conflict(error);
                return BadRequest(error);
            }

            return StatusCode(StatusCodes.Status201Created, skill);
        }

        [HttpPut("skills/{id:guid}")]
        [Authorize]
        public async Task<ActionResult<UserSkillDto>> UpdateSkill(Guid id, [FromBody] UpdateUserSkillRequest request)
        {
            var (skill, error) = await _profileService.UpdateSkillAsync(CurrentUserId(), id, request);
            if (error is not null || skill is null)
                return NotFound();

            return Ok(skill);
        }

        [HttpDelete("skills/{id:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteSkill(Guid id)
        {
            var (success, _) = await _profileService.DeleteSkillAsync(CurrentUserId(), id);
            if (!success)
                return NotFound();

            return NoContent();
        }

        [HttpGet("integrations")]
        [Authorize]
        public async Task<ActionResult<List<UserIntegrationDto>>> GetIntegrations()
        {
            var userId = CurrentUserId();
            var items = await _db.UserIntegrations
                .Where(i => i.UserId == userId)
                .OrderBy(i => i.Provider)
                .Select(i => new UserIntegrationDto
                {
                    Id = i.Id,
                    Provider = i.Provider,
                    AccountIdentifier = i.AccountIdentifier,
                    ConnectedAt = i.ConnectedAt
                })
                .ToListAsync();

            return Ok(items);
        }

        [HttpPost("integrations")]
        [Authorize]
        public async Task<ActionResult<UserIntegrationDto>> UpdateIntegration([FromBody] UpdateIntegrationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Provider))
            {
                return BadRequest("Провайдер обов'язковий.");
            }

            var userId = CurrentUserId();
            var providerKey = request.Provider.Trim().ToLowerInvariant();

            var integration = await _db.UserIntegrations
                .FirstOrDefaultAsync(i => i.UserId == userId && i.Provider == providerKey);

            if (integration is null)
            {
                integration = new UserIntegration
                {
                    UserId = userId,
                    Provider = providerKey,
                    AccountIdentifier = request.AccountIdentifier?.Trim() ?? string.Empty,
                    ConnectedAt = DateTime.UtcNow
                };
                _db.UserIntegrations.Add(integration);
            }
            else
            {
                integration.AccountIdentifier = request.AccountIdentifier?.Trim() ?? string.Empty;
                integration.ConnectedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            return Ok(new UserIntegrationDto
            {
                Id = integration.Id,
                Provider = integration.Provider,
                AccountIdentifier = integration.AccountIdentifier,
                ConnectedAt = integration.ConnectedAt
            });
        }

        [HttpDelete("integrations/{provider}")]
        [Authorize]
        public async Task<IActionResult> DisconnectIntegration(string provider)
        {
            var userId = CurrentUserId();
            var providerKey = provider.Trim().ToLowerInvariant();

            var integration = await _db.UserIntegrations
                .FirstOrDefaultAsync(i => i.UserId == userId && i.Provider == providerKey);

            if (integration is not null)
            {
                _db.UserIntegrations.Remove(integration);
                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")!.Value);
    }
}
