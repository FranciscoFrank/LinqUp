using System;

namespace LinqUp.Shared
{
    public class ProjectChannel
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        public Guid TeamProjectId { get; set; }
        public TeamProject? TeamProject { get; set; }

        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
