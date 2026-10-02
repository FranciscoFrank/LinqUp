using LinqUp.API.Entities;
using LinqUp.API.Identity;

namespace LinqUp.API.Services
{
    public record IssuedTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken, UserSession Session);

    public enum RefreshFailureReason
    {
        None,
        NotFound,
        Expired,
        Reused
    }

    public record RefreshResult(RefreshFailureReason Failure, IssuedTokens? Tokens);

    public interface ITokenService
    {
        string CreateAccessToken(ApplicationUser user, Guid sessionId, out DateTime expiresAt);

        Task<IssuedTokens> CreateSessionAsync(ApplicationUser user, string? deviceName, string? userAgent, string? ipAddress);

        Task<RefreshResult> RefreshAsync(string refreshToken, string? deviceName, string? userAgent, string? ipAddress);

        Task<bool> RevokeByRefreshTokenAsync(string refreshToken);

        Task RevokeSessionAsync(UserSession session);

        string CreateTwoFactorPendingToken(ApplicationUser user);

        bool TryValidateTwoFactorPendingToken(string token, out Guid userId);
    }
}
