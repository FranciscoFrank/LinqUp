using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Hubs;
using LinqUp.API.Services;
using LinqUp.Shared.Dtos.GitHub;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LinqUp.API.Controllers
{
    [Route("api/projects/{projectId:guid}/[controller]")]
    [ApiController]
    public class GitHubController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IGitHubService _gitHub;
        private readonly IHubContext<TeamChatHub> _hubContext;
        private readonly ILogger<GitHubController> _logger;

        public GitHubController(
            AppDbContext db,
            IGitHubService gitHub,
            IHubContext<TeamChatHub> hubContext,
            ILogger<GitHubController> logger)
        {
            _db = db;
            _gitHub = gitHub;
            _hubContext = hubContext;
            _logger = logger;
        }

        private Guid? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }

        private async Task<(string Owner, string Repo)?> GetProjectRepoAsync(Guid projectId)
        {
            var project = await _db.TeamProjects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null || string.IsNullOrWhiteSpace(project.RepositoryUrl))
            {
                return null;
            }

            try
            {
                return _gitHub.ParseRepoUrl(project.RepositoryUrl);
            }
            catch
            {
                return null;
            }
        }

        private string? GetClientGitHubToken()
        {
            return Request.Headers.TryGetValue("X-GitHub-Token", out var token) ? token.ToString() : null;
        }

        // GET: api/projects/{projectId}/github/repo-info
        [HttpGet("repo-info")]
        public async Task<ActionResult<GitHubRepoInfoDto>> GetRepoInfo(Guid projectId)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var info = await _gitHub.GetRepoInfoAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, GetClientGitHubToken());
                return Ok(info);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/branches?page=1&pageSize=10
        [HttpGet("branches")]
        public async Task<ActionResult<List<GitHubBranchDto>>> GetBranches(
            Guid projectId,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var branches = await _gitHub.GetBranchesAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, GetClientGitHubToken());
                if (page.HasValue && pageSize.HasValue)
                {
                    var p = Math.Max(1, page.Value);
                    var ps = Math.Clamp(pageSize.Value, 1, 100);
                    return Ok(branches.Skip((p - 1) * ps).Take(ps).ToList());
                }
                return Ok(branches);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/tree?branch=main&path=src
        [HttpGet("tree")]
        public async Task<ActionResult<List<GitHubTreeItemDto>>> GetTree(
            Guid projectId,
            [FromQuery] string? branch,
            [FromQuery] string? path)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var targetBranch = branch;
                if (string.IsNullOrWhiteSpace(targetBranch))
                {
                    var info = await _gitHub.GetRepoInfoAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, GetClientGitHubToken());
                    targetBranch = info.DefaultBranch;
                }

                var items = await _gitHub.GetTreeOrContentsAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, targetBranch, path, GetClientGitHubToken());
                return Ok(items);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/file?path=README.md&branch=main
        [HttpGet("file")]
        public async Task<ActionResult<GitHubFileContentDto>> GetFile(
            Guid projectId,
            [FromQuery] string path,
            [FromQuery] string? branch)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return BadRequest("Параметр path є обов'язковим.");
            }

            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var targetBranch = branch;
                if (string.IsNullOrWhiteSpace(targetBranch))
                {
                    var info = await _gitHub.GetRepoInfoAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, GetClientGitHubToken());
                    targetBranch = info.DefaultBranch;
                }

                var file = await _gitHub.GetFileContentAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, path, targetBranch, GetClientGitHubToken());
                return Ok(file);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/commits?branch=main&page=1&pageSize=10
        [HttpGet("commits")]
        public async Task<ActionResult<List<GitHubCommitDto>>> GetCommits(
            Guid projectId,
            [FromQuery] string? branch,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var commits = await _gitHub.GetCommitsAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, branch, Math.Max(1, page), Math.Clamp(pageSize, 1, 100), GetClientGitHubToken());
                return Ok(commits);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/commits/{sha}
        [HttpGet("commits/{sha}")]
        public async Task<ActionResult<GitHubCommitDto>> GetCommitDetails(Guid projectId, string sha)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var commit = await _gitHub.GetCommitDetailsAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, sha, GetClientGitHubToken());
                return Ok(commit);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/pulls?state=open&page=1&pageSize=10
        [HttpGet("pulls")]
        public async Task<ActionResult<List<GitHubPullRequestDto>>> GetPullRequests(
            Guid projectId,
            [FromQuery] string state = "all",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var pulls = await _gitHub.GetPullRequestsAsync(projectId, repoCoords.Value.Owner, repoCoords.Value.Repo, state, Math.Max(1, page), Math.Clamp(pageSize, 1, 100), GetClientGitHubToken());
                return Ok(pulls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pull requests for project {ProjectId}", projectId);
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/pulls/{pullNumber}
        [HttpGet("pulls/{pullNumber:int}")]
        public async Task<ActionResult<GitHubPullRequestDto>> GetPullRequestDetails(Guid projectId, int pullNumber)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var pull = await _gitHub.GetPullRequestDetailsAsync(projectId, repoCoords.Value.Owner, repoCoords.Value.Repo, pullNumber, GetClientGitHubToken());
                return Ok(pull);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pull request #{PullNumber} for project {ProjectId}", pullNumber, projectId);
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/pulls/{pullNumber}/files
        [HttpGet("pulls/{pullNumber:int}/files")]
        public async Task<ActionResult<List<GitHubPullRequestFileDto>>> GetPullRequestFiles(Guid projectId, int pullNumber)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var files = await _gitHub.GetPullRequestFilesAsync(repoCoords.Value.Owner, repoCoords.Value.Repo, pullNumber, GetClientGitHubToken());
                return Ok(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pull request files for #{PullNumber}, project {ProjectId}", pullNumber, projectId);
                return BadRequest(ex.Message);
            }
        }

        // GET: api/projects/{projectId}/github/pulls/{pullNumber}/comments
        [HttpGet("pulls/{pullNumber:int}/comments")]
        public async Task<ActionResult<List<GitHubPullRequestCommentDto>>> GetPullRequestComments(Guid projectId, int pullNumber)
        {
            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var comments = await _gitHub.GetPullRequestCommentsAsync(projectId, repoCoords.Value.Owner, repoCoords.Value.Repo, pullNumber, GetClientGitHubToken());
                return Ok(comments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching comments for PR #{PullNumber}, project {ProjectId}", pullNumber, projectId);
                return BadRequest(ex.Message);
            }
        }

        // POST: api/projects/{projectId}/github/pulls/{pullNumber}/comments
        [Authorize]
        [HttpPost("pulls/{pullNumber:int}/comments")]
        public async Task<ActionResult<GitHubPullRequestCommentDto>> AddPullRequestComment(
            Guid projectId,
            int pullNumber,
            [FromBody] CreatePullRequestCommentDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user == null) return Unauthorized();

            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var token = dto.GitHubToken ?? GetClientGitHubToken();
                var fullName = $"{user.FirstName} {user.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(fullName)) fullName = user.Nickname;

                var comment = await _gitHub.AddPullRequestCommentAsync(
                    projectId,
                    repoCoords.Value.Owner,
                    repoCoords.Value.Repo,
                    pullNumber,
                    dto.Body,
                    token,
                    user.Nickname,
                    fullName,
                    user.AvatarPath);

                return Ok(comment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding comment to PR #{PullNumber}, project {ProjectId}", pullNumber, projectId);
                return BadRequest(ex.Message);
            }
        }

        // POST: api/projects/{projectId}/github/pulls/{pullNumber}/approve
        [Authorize]
        [HttpPost("pulls/{pullNumber:int}/approve")]
        public async Task<ActionResult<PullRequestApprovalDto>> ApprovePullRequest(
            Guid projectId,
            int pullNumber,
            [FromBody] ApprovePullRequestRequestDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user == null) return Unauthorized();

            var repoCoords = await GetProjectRepoAsync(projectId);
            if (!repoCoords.HasValue)
            {
                return NotFound("Репозиторій GitHub для цього проєкту ще не налаштовано.");
            }

            try
            {
                var token = dto.GitHubToken ?? GetClientGitHubToken();
                var fullName = $"{user.FirstName} {user.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(fullName)) fullName = user.Nickname;

                var approval = await _gitHub.ApprovePullRequestAsync(
                    projectId,
                    repoCoords.Value.Owner,
                    repoCoords.Value.Repo,
                    pullNumber,
                    user.Id,
                    user.Nickname,
                    fullName,
                    user.AvatarPath,
                    dto.Comment,
                    token);

                await _hubContext.Clients.Group($"project_{projectId}").SendAsync("PullRequestApproved", new
                {
                    pullNumber,
                    approvedByNickname = user.Nickname,
                    comment = dto.Comment
                });

                return Ok(approval);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving PR #{PullNumber}, project {ProjectId}", pullNumber, projectId);
                return BadRequest(ex.Message);
            }
        }


        // PUT: api/projects/{projectId}/github/repo-url
        [Authorize]
        [HttpPut("repo-url")]
        public async Task<IActionResult> UpdateRepoUrl(Guid projectId, [FromBody] UpdateRepoUrlDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var project = await _db.TeamProjects.FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null) return NotFound("Проєкт не знайдено.");

            if (project.CreatorId != userId.Value)
            {
                return Forbid("Лише творець або лідер команди може змінювати репозиторій.");
            }

            if (!string.IsNullOrWhiteSpace(dto.RepositoryUrl))
            {
                try
                {
                    var (owner, repo) = _gitHub.ParseRepoUrl(dto.RepositoryUrl);
                    // Validate repo exists and is public
                    var info = await _gitHub.GetRepoInfoAsync(owner, repo, GetClientGitHubToken());
                    project.RepositoryUrl = info.HtmlUrl;
                }
                catch (Exception ex)
                {
                    return BadRequest($"Неможливо підключити цей репозиторій: {ex.Message}");
                }
            }
            else
            {
                project.RepositoryUrl = string.Empty;
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "Репозиторій успішно оновлено!", repositoryUrl = project.RepositoryUrl });
        }
    }
}
