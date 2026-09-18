using System;
using LinqUp.Shared.Enums;

namespace LinqUp.Shared
{
    public class ProjectTask
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        
        public Guid TeamProjectId { get; set; }
        public TeamProject? TeamProject { get; set; }
        
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        
        // Status can be: Todo, InProgress, Review, Done
        public string Status { get; set; } = "Todo";
        
        // Use string instead of direct ApplicationUser ref in Shared to avoid circular dependencies if any,
        // or just Guid. In API, we can configure navigation.
        public Guid? AssigneeId { get; set; }
        
        public Guid CreatorId { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
