using System.ComponentModel.DataAnnotations;

namespace LinqUp.Shared.Dtos.Projects
{
    public class CreateProjectDto
    {
        [Required(ErrorMessage = "Назва проєкту обов'язкова")]
        [StringLength(120, MinimumLength = 3, ErrorMessage = "Назва має містити від 3 до 120 символів")]
        public string Title { get; set; } = string.Empty;

        [Required(ErrorMessage = "Опис проєкту обов'язковий")]
        [StringLength(3000, MinimumLength = 10, ErrorMessage = "Опис має містити від 10 до 3000 символів")]
        public string Description { get; set; } = string.Empty;

        [Range(2, 50, ErrorMessage = "Кількість учасників має бути від 2 до 50")]
        public int MaxMembers { get; set; } = 5;

        public string RequiredSkills { get; set; } = string.Empty;

        public string RepositoryUrl { get; set; } = string.Empty;

        public string? LogoUrl { get; set; }

        public string CreatorRole { get; set; } = "Team Lead";
    }

    public class UpdateProjectDto
    {
        [Required]
        [StringLength(120, MinimumLength = 3)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(3000, MinimumLength = 10)]
        public string Description { get; set; } = string.Empty;

        [Range(2, 50)]
        public int MaxMembers { get; set; }

        public string RequiredSkills { get; set; } = string.Empty;
        
        public string? RepositoryUrl { get; set; }

        public string? LogoUrl { get; set; }

        public bool IsLookingForMembers { get; set; }

        public string Status { get; set; } = "Recruiting";
    }

    public class ProjectSummaryDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int MaxMembers { get; set; }
        public int CurrentMembersCount { get; set; }
        public bool IsLookingForMembers { get; set; }
        public string Status { get; set; } = "Recruiting";
        public string RequiredSkills { get; set; } = string.Empty;
        public string RepositoryUrl { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public int? MatchPercentage { get; set; }
        public Guid CreatorId { get; set; }
        public string CreatorNickname { get; set; } = string.Empty;
        public string CreatorFullName { get; set; } = string.Empty;
        public string? CreatorAvatarPath { get; set; }
        public bool IsUserMember { get; set; }
        public string? UserRole { get; set; }
    }

    public class ProjectMemberDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public string? AvatarPath { get; set; }
        public string Role { get; set; } = "Developer";
        public DateTime JoinedAt { get; set; }
        public bool IsLeader { get; set; }
    }

    public class ProjectDetailsDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int MaxMembers { get; set; }
        public bool IsLookingForMembers { get; set; }
        public string Status { get; set; } = "Recruiting";
        public string RequiredSkills { get; set; } = string.Empty;
        public string RepositoryUrl { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public int? MatchPercentage { get; set; }
        public Guid CreatorId { get; set; }
        public bool IsUserLeader { get; set; }
        public bool IsUserMember { get; set; }
        public string? UserRole { get; set; }
        public bool HasPendingJoinRequest { get; set; }

        public List<ProjectMemberDto> Members { get; set; } = new();
        public List<JoinRequestDto> PendingRequests { get; set; } = new();
    }

    public class CreateJoinRequestDto
    {
        [StringLength(1000, ErrorMessage = "Супровідне повідомлення до 1000 символів")]
        public string CoverMessage { get; set; } = string.Empty;

        [Required(ErrorMessage = "Вкажіть бажану роль")]
        [StringLength(50)]
        public string RequestedRole { get; set; } = "Developer";
    }

    public class RespondJoinRequestDto
    {
        public bool Accept { get; set; }
        public string? AssignedRole { get; set; }
    }

    public class JoinRequestDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public string? AvatarPath { get; set; }
        public string CoverMessage { get; set; } = string.Empty;
        public string RequestedRole { get; set; } = "Developer";
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; }
    }

    public class ProjectTaskDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "Todo";
        public Guid? AssigneeId { get; set; }
        public string? AssigneeNickname { get; set; }
        public string? AssigneeAvatarPath { get; set; }
        public Guid CreatorId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateProjectTaskDto
    {
        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;
        
        [StringLength(4000)]
        public string Description { get; set; } = string.Empty;
        
        public string Status { get; set; } = "Todo";
        public Guid? AssigneeId { get; set; }
    }
}
