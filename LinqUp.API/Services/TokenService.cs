using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LinqUp.API.Data;
using LinqUp.API.Entities;
using LinqUp.API.Identity;
using LinqUp.API.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LinqUp.API.Services
{
    public class TokenService : ITokenService
    {
        private readonly AppDbContext _db;
        private readonly JwtOptions _options;

        public TokenService(AppDbContext db, IOptions<JwtOptions> options)
        {
            _db = db;
            _options = options.Value;
        }

        public string CreateAccessToken(ApplicationUser user, Guid sessionId, out DateTime expiresAt)
        {
            expiresAt = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new("sid", sessionId.ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: _options.Audience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<IssuedTokens> CreateSessionAsync(ApplicationUser user, string? deviceName, string? userAgent, string? ipAddress)
        {
            var (plaintext, hash) = GenerateRefreshToken();

            var session = new UserSession
            {
                UserId = user.Id,
                RefreshTokenHash = hash,
                DeviceName = deviceName,
                UserAgent = userAgent,
                IpAddress = ipAddress,
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenDays)
            };

            _db.UserSessions.Add(session);
            await _db.SaveChangesAsync();

            var accessToken = CreateAccessToken(user, session.Id, out var expiresAt);
            return new IssuedTokens(accessToken, expiresAt, plaintext, session);
        }

        public async Task<RefreshResult> RefreshAsync(string refreshToken, string? deviceName, string? userAgent, string? ipAddress)
        {
            var hash = Hash(refreshToken);
            var session = await _db.UserSessions
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash);

            if (session is null)
            {
                return new RefreshResult(RefreshFailureReason.NotFound, null);
            }

            if (session.RevokedAt is not null)
            {
                if (session.ReplacedBySessionId is not null)
                {
                    // A rotated-away token was reused — treat the whole chain as compromised.
                    await RevokeChainAsync(session);
                }

                return new RefreshResult(RefreshFailureReason.Reused, null);
            }

            if (session.ExpiresAt <= DateTime.UtcNow)
            {
                return new RefreshResult(RefreshFailureReason.Expired, null);
            }

            var user = session.User ?? await _db.Users.FirstAsync(u => u.Id == session.UserId);

            var (plaintext, newHash) = GenerateRefreshToken();
            var newSession = new UserSession
            {
                UserId = user.Id,
                RefreshTokenHash = newHash,
                DeviceName = deviceName ?? session.DeviceName,
                UserAgent = userAgent ?? session.UserAgent,
                IpAddress = ipAddress ?? session.IpAddress,
                CreatedAt = session.CreatedAt,
                LastUsedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenDays)
            };

            _db.UserSessions.Add(newSession);
            await _db.SaveChangesAsync();

            session.RevokedAt = DateTime.UtcNow;
            session.ReplacedBySessionId = newSession.Id;
            await _db.SaveChangesAsync();

            var accessToken = CreateAccessToken(user, newSession.Id, out var expiresAt);
            return new RefreshResult(RefreshFailureReason.None, new IssuedTokens(accessToken, expiresAt, plaintext, newSession));
        }

        private const string TwoFactorPendingAudience = "LinqUp.TwoFactorPending";

        public string CreateTwoFactorPendingToken(ApplicationUser user)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: TwoFactorPendingAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public bool TryValidateTwoFactorPendingToken(string token, out Guid userId)
        {
            userId = Guid.Empty;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));

            var parameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _options.Issuer,
                ValidateAudience = true,
                ValidAudience = TwoFactorPendingAudience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ClockSkew = TimeSpan.FromSeconds(30)
            };

            try
            {
                var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
                var principal = handler.ValidateToken(token, parameters, out _);
                var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
                if (sub is not null && Guid.TryParse(sub, out userId))
                {
                    return true;
                }
            }
            catch (SecurityTokenException)
            {
            }

            return false;
        }

        public async Task<bool> RevokeByRefreshTokenAsync(string refreshToken)
        {
            var hash = Hash(refreshToken);
            var session = await _db.UserSessions.FirstOrDefaultAsync(s => s.RefreshTokenHash == hash);
            if (session is null || session.RevokedAt is not null)
            {
                return false;
            }

            session.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task RevokeSessionAsync(UserSession session)
        {
            session.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        private async Task RevokeChainAsync(UserSession session)
        {
            var current = session;
            while (current.ReplacedBySessionId is not null)
            {
                var next = await _db.UserSessions.FindAsync(current.ReplacedBySessionId.Value);
                if (next is null)
                {
                    break;
                }

                if (next.RevokedAt is null)
                {
                    next.RevokedAt = DateTime.UtcNow;
                }

                current = next;
            }

            await _db.SaveChangesAsync();
        }

        private static (string plaintext, string hash) GenerateRefreshToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(32);
            var plaintext = Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');

            return (plaintext, Hash(plaintext));
        }

        private static string Hash(string value)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexString(bytes);
        }
    }
}
