using System;

namespace LinqUp.Shared
{
    public class ProjectMembership
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid UserId { get; set; }

        public Guid TeamProjectId { get; set; }
        public TeamProject? TeamProject { get; set; }

        public string Role { get; set; } = "Developer";

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
