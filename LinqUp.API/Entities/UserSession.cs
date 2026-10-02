using LinqUp.API.Identity;

namespace LinqUp.API.Entities
{
    public class UserSession
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid UserId { get; set; }
        public ApplicationUser? User { get; set; }

        // SHA-256 hash of the refresh token — the plaintext token is never stored.
        public string RefreshTokenHash { get; set; } = string.Empty;

        public string? DeviceName { get; set; }
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }

        // Points to the session row created when this refresh token was rotated,
        // so reuse of a revoked token can be detected and the whole chain killed.
        public Guid? ReplacedBySessionId { get; set; }

        public bool IsActive => RevokedAt == null && ExpiresAt > DateTime.UtcNow;
    }
}
