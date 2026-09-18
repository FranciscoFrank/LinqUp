using System;
using LinqUp.Shared.Enums;

namespace LinqUp.Shared
{
    public class ProjectJoinRequest
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamProjectId { get; set; }
        public TeamProject? TeamProject { get; set; }

        public Guid UserId { get; set; }

        public string CoverMessage { get; set; } = string.Empty;

        public string RequestedRole { get; set; } = "Developer";

        public JoinRequestStatus Status { get; set; } = JoinRequestStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? RespondedAt { get; set; }
    }
}
