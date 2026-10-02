using System;

namespace LinqUp.API.Entities
{
    public class ProjectMeeting
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamProjectId { get; set; }

        public string RoomName { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public Guid HostUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;

        public DateTime? EndedAt { get; set; }
    }
}
