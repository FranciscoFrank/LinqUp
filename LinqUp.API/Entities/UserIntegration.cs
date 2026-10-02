using LinqUp.API.Identity;

namespace LinqUp.API.Entities
{
    public class UserIntegration
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid UserId { get; set; }
        public ApplicationUser? User { get; set; }

        public string Provider { get; set; } = string.Empty;
        public string AccountIdentifier { get; set; } = string.Empty;
        public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
    }
}
