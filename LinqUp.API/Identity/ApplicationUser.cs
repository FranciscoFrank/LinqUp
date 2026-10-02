using LinqUp.API.Entities;
using Microsoft.AspNetCore.Identity;

namespace LinqUp.API.Identity
{
    public class ApplicationUser : IdentityUser<Guid>
    {
        public ApplicationUser()
        {
            // IdentityUser<TKey> does not auto-generate non-string keys.
            Id = Guid.CreateVersion7();
        }

        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;

        // Always stored lowercase — enforced wherever it is written, never on read.
        public string Nickname { get; set; } = string.Empty;

        public string Bio { get; set; } = string.Empty;
        public string? AvatarPath { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<ContactMethod> ContactMethods { get; set; } = new();
        public List<UserSkill> Skills { get; set; } = new();
        public List<UserSession> Sessions { get; set; } = new();
        public List<UserIntegration> Integrations { get; set; } = new();

        public bool IsOpenToWork { get; set; } = false;
        public string? Goal { get; set; }
        
        public List<UserConnection> Connections { get; set; } = new();
        public List<SkillEndorsement> GivenEndorsements { get; set; } = new();
        public List<SkillEndorsement> ReceivedEndorsements { get; set; } = new();
    }
}
