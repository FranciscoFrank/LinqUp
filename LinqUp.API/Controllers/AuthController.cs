using LinqUp.API.Data;
using LinqUp.API.Identity;
using LinqUp.API.Services;
using LinqUp.Shared.Dtos.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using LinqUp.API.Options;
using Microsoft.Extensions.Options;

namespace LinqUp.API.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITokenService _tokenService;
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;
        private readonly IOptions<ResendEmailOptions> _resendOptions;
        private readonly IOptions<JwtOptions> _jwtOptions;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            ITokenService tokenService,
            AppDbContext db,
            IEmailService emailService,
            IOptions<ResendEmailOptions> resendOptions,
            IOptions<JwtOptions> jwtOptions)
        {
            _userManager = userManager;
            _tokenService = tokenService;
            _db = db;
            _emailService = emailService;
            _resendOptions = resendOptions;
            _jwtOptions = jwtOptions;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("Email і пароль обов'язкові.");
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                return BadRequest(result.Errors.Select(e => e.Description));
            }

            // Default, always-unique nickname; the user can pick a real one via PUT /api/profile/me.
            user.Nickname = $"user-{user.Id:N}"[..13];
            await _userManager.UpdateAsync(user);

            try
            {
                var emailToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
                var confirmUrl = $"{_resendOptions.Value.WebBaseUrl}/uk/auth/confirm-email?userId={user.Id}&token={Uri.EscapeDataString(emailToken)}";
                _ = _emailService.SendEmailConfirmationAsync(user.Email!, confirmUrl);
            }
            catch
            {
                // Soft-fail: Do not crash registration if email dispatch encounters an error
            }

            return StatusCode(StatusCodes.Status201Created, new { user.Id, user.Email, user.Nickname });
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user is null)
            {
                return Unauthorized("Невірний email або пароль.");
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                return StatusCode(StatusCodes.Status423Locked, "Обліковий запис тимчасово заблоковано через забагато невдалих спроб.");
            }

            if (!await _userManager.CheckPasswordAsync(user, request.Password))
            {
                await _userManager.AccessFailedAsync(user);
                return Unauthorized("Невірний email або пароль.");
            }

            await _userManager.ResetAccessFailedCountAsync(user);

            if (user.TwoFactorEnabled)
            {
                return Ok(new LoginResponse
                {
                    RequiresTwoFactor = true,
                    TwoFactorToken = _tokenService.CreateTwoFactorPendingToken(user)
                });
            }

            var issued = await _tokenService.CreateSessionAsync(user, request.DeviceName, UserAgent(), IpAddress());
            SetTokenCookies(issued);

            try
            {
                _ = _emailService.SendNewLoginAlertEmailAsync(user.Email!, request.DeviceName ?? UserAgent(), IpAddress(), DateTime.UtcNow);
            }
            catch
            {
            }

            return Ok(ToResponse(issued));
        }

        [HttpPost("login/2fa")]
        public async Task<ActionResult<LoginResponse>> LoginTwoFactor([FromBody] TwoFactorLoginRequest request)
        {
            if (!_tokenService.TryValidateTwoFactorPendingToken(request.TwoFactorToken, out var userId))
            {
                return Unauthorized("Недійсний або прострочений токен 2FA.");
            }

            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null)
            {
                return Unauthorized();
            }

            bool codeValid;
            if (request.IsRecoveryCode)
            {
                var cleanCode = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
                if (cleanCode.Length == 12 && !cleanCode.Contains('-'))
                {
                    cleanCode = $"{cleanCode[..4]}-{cleanCode[4..8]}-{cleanCode[8..12]}";
                }
                var result = await _userManager.RedeemTwoFactorRecoveryCodeAsync(user, cleanCode);
                codeValid = result.Succeeded;
            }
            else
            {
                var cleanCode = (request.Code ?? string.Empty).Trim().Replace(" ", "").Replace("-", "");
                codeValid = await _userManager.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, cleanCode);
            }

            if (!codeValid)
            {
                return Unauthorized("Невірний код 2FA.");
            }

            var issued = await _tokenService.CreateSessionAsync(user, request.DeviceName, UserAgent(), IpAddress());
            SetTokenCookies(issued);

            try
            {
                _ = _emailService.SendNewLoginAlertEmailAsync(user.Email!, request.DeviceName ?? UserAgent(), IpAddress(), DateTime.UtcNow);
            }
            catch
            {
            }

            return Ok(ToResponse(issued));
        }

        [HttpPost("refresh")]
        public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshRequest? request)
        {
            var refreshToken = request?.RefreshToken ?? Request.Cookies["linqup_refresh_token"];
            if (string.IsNullOrEmpty(refreshToken))
            {
                return Unauthorized("Немає refresh токена.");
            }

            var result = await _tokenService.RefreshAsync(refreshToken, null, UserAgent(), IpAddress());

            if (result.Failure != RefreshFailureReason.None || result.Tokens is null)
            {
                ClearTokenCookies();
                return Unauthorized("Сесію завершено, увійдіть повторно.");
            }

            SetTokenCookies(result.Tokens);
            return Ok(ToResponse(result.Tokens));
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshRequest? request)
        {
            var refreshToken = request?.RefreshToken ?? Request.Cookies["linqup_refresh_token"];
            if (!string.IsNullOrEmpty(refreshToken))
            {
                await _tokenService.RevokeByRefreshTokenAsync(refreshToken);
            }

            var sidClaim = User.FindFirst("sid")?.Value;
            if (Guid.TryParse(sidClaim, out var sid))
            {
                var session = await _db.UserSessions.FindAsync(sid);
                if (session != null && session.RevokedAt == null)
                {
                    session.RevokedAt = DateTime.UtcNow;
                    session.LastUsedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                }
            }

            ClearTokenCookies();
            return NoContent();
        }

        [HttpGet("sessions")]
        [Authorize]
        public async Task<ActionResult<List<SessionDto>>> GetSessions()
        {
            var userId = CurrentUserId();
            var currentSessionId = CurrentSessionId();

            var sessions = await _db.UserSessions
                .Where(s => s.UserId == userId && s.RevokedAt == null && s.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(s => s.LastUsedAt)
                .ToListAsync();

            return Ok(sessions.Select(s => new SessionDto
            {
                Id = s.Id,
                DeviceName = s.DeviceName,
                UserAgent = s.UserAgent,
                IpAddress = s.IpAddress,
                CreatedAt = s.CreatedAt,
                LastUsedAt = s.Id == currentSessionId ? DateTime.UtcNow : s.LastUsedAt,
                IsCurrent = s.Id == currentSessionId
            }));
        }

        [HttpDelete("sessions/{id:guid}")]
        [Authorize]
        public async Task<IActionResult> RevokeSession(Guid id)
        {
            var userId = CurrentUserId();
            var session = await _db.UserSessions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (session is null)
            {
                return NotFound();
            }

            if (session.RevokedAt is null)
            {
                session.RevokedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpPost("sessions/revoke-all")]
        [Authorize]
        public async Task<IActionResult> RevokeAllOtherSessions()
        {
            var userId = CurrentUserId();
            var currentSessionId = CurrentSessionId();

            var sessions = await _db.UserSessions
                .Where(s => s.UserId == userId && s.RevokedAt == null && s.Id != currentSessionId)
                .ToListAsync();

            foreach (var session in sessions)
            {
                session.RevokedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("2fa/setup")]
        [Authorize]
        public async Task<ActionResult<TwoFactorSetupResponse>> SetupTwoFactor()
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            var key = await _userManager.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(key))
            {
                await _userManager.ResetAuthenticatorKeyAsync(user);
                key = await _userManager.GetAuthenticatorKeyAsync(user);
            }

            var email = Uri.EscapeDataString(user.Email ?? user.Nickname);
            var uri = $"otpauth://totp/LinqUp:{email}?secret={key}&issuer=LinqUp&digits=6";

            return Ok(new TwoFactorSetupResponse { ManualEntryKey = key ?? string.Empty, OtpAuthUri = uri });
        }

        [HttpPost("2fa/enable")]
        [Authorize]
        public async Task<ActionResult<RecoveryCodesResponse>> EnableTwoFactor([FromBody] EnableTwoFactorRequest request)
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            var valid = await _userManager.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, request.Code);
            if (!valid)
            {
                return BadRequest("Невірний код підтвердження.");
            }

            await _userManager.SetTwoFactorEnabledAsync(user, true);
            var codes = await GenerateCustomRecoveryCodesAsync(user);

            try
            {
                _ = _emailService.SendTwoFactorEnabledEmailAsync(user.Email!, UserAgent(), IpAddress());
            }
            catch
            {
            }

            return Ok(new RecoveryCodesResponse { RecoveryCodes = codes });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest("Вкажіть email адресу.");
            }

            var user = await _userManager.FindByEmailAsync(request.Email.Trim());
            if (user != null)
            {
                try
                {
                    var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                    var resetLink = $"{_resendOptions.Value.WebBaseUrl}/uk/auth/reset-password?userId={user.Id}&token={Uri.EscapeDataString(token)}";
                    _ = _emailService.SendPasswordResetEmailAsync(user.Email!, resetLink);
                }
                catch
                {
                }
            }

            return Ok(new { message = "Якщо вказаний email зареєстрований, лист з інструкціями для відновлення паролю було надіслано на вашу пошту." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest("Усі поля обов'язкові.");
            }

            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return BadRequest("Недійсне посилання для відновлення або користувача не знайдено.");
            }

            var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
            if (!result.Succeeded)
            {
                return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
            }

            var sessions = await _db.UserSessions.Where(s => s.UserId == user.Id && s.RevokedAt == null).ToListAsync();
            foreach (var s in sessions)
            {
                s.RevokedAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();

            return Ok(new { message = "Пароль успішно оновлено! Тепер ви можете увійти з новим паролем." });
        }

        [HttpPost("confirm-email")]
        public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest("Некоректні параметри підтвердження.");
            }

            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return NotFound("Користувача не знайдено.");
            }

            var result = await _userManager.ConfirmEmailAsync(user, request.Token);
            if (!result.Succeeded)
            {
                return BadRequest("Недійсний або прострочений токен підтвердження.");
            }

            return Ok(new { message = "Email адресу успішно підтверджено!" });
        }

        private static string GenerateRecoveryCode()
        {
            const string chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
            return string.Create(14, chars, (span, alphabet) =>
            {
                for (int i = 0; i < 14; i++)
                {
                    if (i == 4 || i == 9)
                    {
                        span[i] = '-';
                    }
                    else
                    {
                        span[i] = alphabet[System.Security.Cryptography.RandomNumberGenerator.GetInt32(alphabet.Length)];
                    }
                }
            });
        }

        private async Task<List<string>> GenerateCustomRecoveryCodesAsync(ApplicationUser user)
        {
            var codes = new List<string>(5);
            for (int i = 0; i < 5; i++)
            {
                codes.Add(GenerateRecoveryCode());
            }

            var mergedCodes = string.Join(";", codes);
            await _userManager.SetAuthenticationTokenAsync(user, "[AspNetUserStore]", "RecoveryCodes", mergedCodes);

            return codes;
        }

        [HttpPost("2fa/disable")]
        [Authorize]
        public async Task<IActionResult> DisableTwoFactor([FromBody] DisableTwoFactorRequest request)
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            if (!await _userManager.CheckPasswordAsync(user, request.Password))
            {
                return BadRequest("Невірний пароль.");
            }

            await _userManager.SetTwoFactorEnabledAsync(user, false);
            await _userManager.ResetAuthenticatorKeyAsync(user);

            return NoContent();
        }

        [HttpPost("2fa/recovery-codes/regenerate")]
        [Authorize]
        public async Task<ActionResult<RecoveryCodesResponse>> RegenerateRecoveryCodes()
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            if (!user.TwoFactorEnabled)
            {
                return BadRequest("2FA не увімкнено.");
            }

            var codes = await GenerateCustomRecoveryCodesAsync(user);
            return Ok(new RecoveryCodesResponse { RecoveryCodes = codes });
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest("Поточний та новий паролі обов'язкові.");
            }

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!result.Succeeded)
            {
                return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
            }

            var sid = User.FindFirst("sid")?.Value;
            if (!string.IsNullOrEmpty(sid))
            {
                var sessions = await _db.UserSessions.Where(s => s.UserId == user.Id).ToListAsync();
                foreach (var session in sessions)
                {
                    if (session.Id.ToString() != sid && session.RevokedAt == null)
                    {
                        session.RevokedAt = DateTime.UtcNow;
                        session.ReplacedBySessionId = null;
                    }
                }
                await _db.SaveChangesAsync();
            }

            return Ok(new { message = "Пароль успішно змінено." });
        }

        [HttpPost("change-email")]
        [Authorize]
        public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest request)
        {
            var user = await CurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.NewEmail) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("Новий email та пароль обов'язкові.");
            }

            var newEmail = request.NewEmail.Trim().ToLowerInvariant();
            if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Новий email співпадає з поточним.");
            }

            if (!await _userManager.CheckPasswordAsync(user, request.Password))
            {
                return BadRequest("Невірний пароль для підтвердження.");
            }

            var existing = await _userManager.FindByEmailAsync(newEmail);
            if (existing is not null && existing.Id != user.Id)
            {
                return Conflict("Цей email вже використовується іншим акаунтом.");
            }

            var token = await _userManager.GenerateChangeEmailTokenAsync(user, newEmail);
            var result = await _userManager.ChangeEmailAsync(user, newEmail, token);
            if (!result.Succeeded)
            {
                return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
            }

            await _userManager.SetUserNameAsync(user, newEmail);

            return Ok(new { email = user.Email, message = "Email успішно змінено." });
        }

        private static LoginResponse ToResponse(IssuedTokens tokens) => new()
        {
            // We still return these for backward compatibility or if the client needs to know expiry,
            // but the actual tokens will be handled by cookies.
            AccessToken = "",
            AccessTokenExpiresAt = tokens.AccessTokenExpiresAt,
            RefreshToken = ""
        };

        private void SetTokenCookies(IssuedTokens tokens)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = tokens.AccessTokenExpiresAt
            };
            Response.Cookies.Append("linqup_access_token", tokens.AccessToken, cookieOptions);

            var refreshOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = DateTime.UtcNow.AddDays(_jwtOptions.Value.RefreshTokenDays)
            };
            Response.Cookies.Append("linqup_refresh_token", tokens.RefreshToken, refreshOptions);
        }

        private void ClearTokenCookies()
        {
            Response.Cookies.Delete("linqup_access_token");
            Response.Cookies.Delete("linqup_refresh_token");
        }

        private string? UserAgent() => Request.Headers.UserAgent.ToString();

        private string? IpAddress() => HttpContext.Connection.RemoteIpAddress?.ToString();

        private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")!.Value);

        private Guid CurrentSessionId() => Guid.Parse(User.FindFirst("sid")!.Value);

        private Task<ApplicationUser?> CurrentUserAsync() => _userManager.FindByIdAsync(CurrentUserId().ToString());
    }
}
