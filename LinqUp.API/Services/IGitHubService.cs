using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LinqUp.API.Identity;
using LinqUp.Shared.Dtos.GitHub;

namespace LinqUp.API.Services
{
    public interface IGitHubService
    {
        (string Owner, string Repo) ParseRepoUrl(string url);
        Task<GitHubRepoInfoDto> GetRepoInfoAsync(string owner, string repo, string? token = null);
        Task<List<GitHubBranchDto>> GetBranchesAsync(string owner, string repo, string? token = null);
        Task<List<GitHubTreeItemDto>> GetTreeOrContentsAsync(string owner, string repo, string branch, string? path = null, string? token = null);
        Task<GitHubFileContentDto> GetFileContentAsync(string owner, string repo, string path, string branch, string? token = null);
        Task<List<GitHubCommitDto>> GetCommitsAsync(string owner, string repo, string? branch = null, int page = 1, int pageSize = 10, string? token = null);
        Task<GitHubCommitDto> GetCommitDetailsAsync(string owner, string repo, string sha, string? token = null);
        Task<List<GitHubPullRequestDto>> GetPullRequestsAsync(Guid projectId, string owner, string repo, string state = "all", int page = 1, int pageSize = 10, string? token = null);
        Task<GitHubPullRequestDto> GetPullRequestDetailsAsync(Guid projectId, string owner, string repo, int pullNumber, string? token = null);
        Task<List<GitHubPullRequestFileDto>> GetPullRequestFilesAsync(string owner, string repo, int pullNumber, string? token = null);
        Task<List<GitHubPullRequestCommentDto>> GetPullRequestCommentsAsync(Guid projectId, string owner, string repo, int pullNumber, string? token = null);
        Task<GitHubPullRequestCommentDto> AddPullRequestCommentAsync(Guid projectId, string owner, string repo, int pullNumber, string body, string? token = null, string? authorNickname = null, string? authorFullName = null, string? authorAvatar = null);
        Task<PullRequestApprovalDto> ApprovePullRequestAsync(Guid projectId, string owner, string repo, int pullNumber, Guid userId, string userNickname, string userFullName, string? userAvatar = null, string? comment = null, string? token = null);
    }
}
