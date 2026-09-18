using System;
using System.Collections.Generic;
using LinqUp.Shared.Enums;

namespace LinqUp.Shared
{
    public class TeamProject
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string CreatedBy { get; set; } = string.Empty;

        public Guid CreatorId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int MaxMembers { get; set; } = 5;

        public bool IsLookingForMembers { get; set; } = true;

        public ProjectStatus Status { get; set; } = ProjectStatus.Recruiting;

        /// <summary>
        /// Comma-separated list or JSON array of required tech stack/skills tags (e.g., "C#,React,PostgreSQL")
        /// </summary>
        public string RequiredSkills { get; set; } = string.Empty;

        public string RepositoryUrl { get; set; } = string.Empty;

        public string? LogoUrl { get; set; }

        public List<ProjectMembership> Members { get; set; } = new();

        public List<ProjectJoinRequest> JoinRequests { get; set; } = new();

        public List<ProjectChannel> Channels { get; set; } = new();

        public List<TeamMessage> Messages { get; set; } = new();
    }
}
