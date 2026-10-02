using System;
using LinqUp.API.Identity;

namespace LinqUp.API.Entities
{
    public class UserConnection
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        
        public Guid RequesterId { get; set; }
        public ApplicationUser? Requester { get; set; }
        
        public Guid TargetUserId { get; set; }
        public ApplicationUser? TargetUser { get; set; }
        
        public bool IsAccepted { get; set; } = false;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
