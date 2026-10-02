using System;

namespace LinqUp.API.Entities
{
    public class ProjectPullRequestApproval
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamProjectId { get; set; }

        public int PullNumber { get; set; }

        public Guid UserId { get; set; }

        public string UserNickname { get; set; } = string.Empty;

        public string UserFullName { get; set; } = string.Empty;

        public string? UserAvatarPath { get; set; }

        public string? Comment { get; set; }

        public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;

        public bool SyncedToGitHub { get; set; }
    }
}
