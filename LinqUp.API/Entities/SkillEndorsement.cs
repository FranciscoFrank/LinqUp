using System;
using LinqUp.API.Identity;

namespace LinqUp.API.Entities
{
    public class SkillEndorsement
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        
        public Guid EndorserId { get; set; }
        public ApplicationUser? Endorser { get; set; }
        
        public Guid EndorsedUserId { get; set; }
        public ApplicationUser? EndorsedUser { get; set; }
        
        public Guid SkillId { get; set; }
        public Skill? Skill { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
