using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LinqUp.Shared.Dtos.GitHub
{
    public class GitHubRepoInfoDto
    {
        public string Owner { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DefaultBranch { get; set; } = "main";
        public int StarsCount { get; set; }
        public int ForksCount { get; set; }
        public int OpenIssuesCount { get; set; }
        public string HtmlUrl { get; set; } = string.Empty;
        public bool IsPrivate { get; set; }
        public string Language { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
    }

    public class GitHubBranchDto
    {
        public string Name { get; set; } = string.Empty;
        public string CommitSha { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
        public bool Protected { get; set; }
    }

    public class GitHubTreeItemDto
    {
        public string Path { get; set; } = string.Empty;
        public string Mode { get; set; } = string.Empty;
        public string Type { get; set; } = "blob"; // "blob" (file) or "tree" (dir)
        public string Sha { get; set; } = string.Empty;
        public long? Size { get; set; }
        public string Url { get; set; } = string.Empty;
    }

    public class GitHubFileContentDto
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public string Sha { get; set; } = string.Empty;
        public long Size { get; set; }
        public string Content { get; set; } = string.Empty;
        public string Encoding { get; set; } = "utf-8";
        public string HtmlUrl { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;
        public int TotalLines { get; set; }
        public bool IsBinary { get; set; }
    }

    public class GitHubCommitDto
    {
        public string Sha { get; set; } = string.Empty;
        public string ShortSha => Sha.Length >= 7 ? Sha.Substring(0, 7) : Sha;
        public string Message { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorEmail { get; set; } = string.Empty;
        public string? AuthorAvatarUrl { get; set; }
        public DateTime Date { get; set; }
        public string HtmlUrl { get; set; } = string.Empty;
        public int Additions { get; set; }
        public int Deletions { get; set; }
        public int TotalChanges { get; set; }
    }

    public class GitHubPullRequestDto
    {
        public int Number { get; set; }
        public string Title { get; set; } = string.Empty;
        public string State { get; set; } = "open"; // open, closed
        public string Body { get; set; } = string.Empty;
        public string HtmlUrl { get; set; } = string.Empty;
        public string UserLogin { get; set; } = string.Empty;
        public string? UserAvatarUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime? MergedAt { get; set; }
        public bool IsMerged => MergedAt.HasValue;
        public string HeadRef { get; set; } = string.Empty;
        public string BaseRef { get; set; } = string.Empty;
        public int CommentsCount { get; set; }
        public int Additions { get; set; }
        public int Deletions { get; set; }
        public int ChangedFiles { get; set; }
        public bool IsApproved { get; set; }
        public List<PullRequestApprovalDto> Approvals { get; set; } = new();
    }

    public class GitHubPullRequestFileDto
    {
        public string Sha { get; set; } = string.Empty;
        public string Filename { get; set; } = string.Empty;
        public string Status { get; set; } = "modified"; // added, removed, modified, renamed
        public int Additions { get; set; }
        public int Deletions { get; set; }
        public int Changes { get; set; }
        public string Patch { get; set; } = string.Empty;
        public string RawUrl { get; set; } = string.Empty;
    }

    public class ApprovePullRequestRequestDto
    {
        [StringLength(1000)]
        public string? Comment { get; set; }

        public string? GitHubToken { get; set; }
    }

    public class PullRequestApprovalDto
    {
        public Guid Id { get; set; }
        public int PullNumber { get; set; }
        public Guid UserId { get; set; }
        public string UserNickname { get; set; } = string.Empty;
        public string UserFullName { get; set; } = string.Empty;
        public string? UserAvatarPath { get; set; }
        public string? Comment { get; set; }
        public DateTime ApprovedAt { get; set; }
        public bool SyncedToGitHub { get; set; }
    }

    public class UpdateRepoUrlDto
    {
        [Required]
        public string RepositoryUrl { get; set; } = string.Empty;
    }

    public class GitHubPullRequestCommentDto
    {
        public long Id { get; set; }
        public string UserLogin { get; set; } = string.Empty;
        public string? UserAvatarUrl { get; set; }
        public string Body { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? HtmlUrl { get; set; }
        public string? AuthorAssociation { get; set; }
        public bool IsReviewComment { get; set; }
        public string? Path { get; set; }
        public int? Line { get; set; }
        public string? DiffHunk { get; set; }
    }

    public class CreatePullRequestCommentDto
    {
        [Required]
        [MinLength(1)]
        [MaxLength(4000)]
        public string Body { get; set; } = string.Empty;

        public string? GitHubToken { get; set; }
    }
}

