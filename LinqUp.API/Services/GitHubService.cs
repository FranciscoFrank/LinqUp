using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using LinqUp.API.Data;
using LinqUp.API.Entities;
using LinqUp.API.Identity;
using LinqUp.Shared.Dtos.GitHub;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LinqUp.API.Services
{
    public class GitHubService : IGitHubService
    {
        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _config;
        private readonly AppDbContext _db;
        private readonly ILogger<GitHubService> _logger;

        private static readonly TimeSpan DefaultCacheDuration = TimeSpan.FromMinutes(2);

        public GitHubService(
            HttpClient httpClient,
            IMemoryCache cache,
            IConfiguration config,
            AppDbContext db,
            ILogger<GitHubService> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _config = config;
            _db = db;
            _logger = logger;

            if (_httpClient.BaseAddress == null)
            {
                _httpClient.BaseAddress = new Uri("https://api.github.com/");
            }
        }

        public (string Owner, string Repo) ParseRepoUrl(string url)
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                throw new ArgumentException("Адреса репозиторію не може бути порожньою.");
            }

            url = url.Trim();

            // Match patterns like:
            // https://github.com/owner/repo
            // https://github.com/owner/repo.git
            // github.com/owner/repo
            // owner/repo
            var match = Regex.Match(url, @"^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git)?(?:\/.*)?$");
            if (match.Success)
            {
                return (match.Groups[1].Value, match.Groups[2].Value);
            }

            var simpleMatch = Regex.Match(url, @"^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git)?$");
            if (simpleMatch.Success)
            {
                return (simpleMatch.Groups[1].Value, simpleMatch.Groups[2].Value);
            }

            throw new ArgumentException("Некоректний формат GitHub URL. Вкажіть посилання на публічний репозиторій (наприклад: owner/repo або https://github.com/owner/repo).");
        }

        private HttpRequestMessage CreateRequest(HttpMethod method, string path, string? token = null)
        {
            var req = new HttpRequestMessage(method, path);
            req.Headers.UserAgent.Add(new ProductInfoHeaderValue("LinqUp-App", "1.0"));
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json"));

            var effectiveToken = !string.IsNullOrWhiteSpace(token)
                ? token
                : _config["GitHub:Token"];

            if (!string.IsNullOrWhiteSpace(effectiveToken))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", effectiveToken.Trim());
            }

            return req;
        }

        private static string? GetStringSafe(JsonElement el, string propertyName)
        {
            if (el.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String)
            {
                return prop.GetString();
            }
            return null;
        }

        private static int GetInt32Safe(JsonElement el, string propertyName, int defaultValue = 0)
        {
            if (el.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.Number && prop.TryGetInt32(out var val))
            {
                return val;
            }
            return defaultValue;
        }

        private static long? GetInt64Safe(JsonElement el, string propertyName)
        {
            if (el.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.Number && prop.TryGetInt64(out var val))
            {
                return val;
            }
            return null;
        }

        private static DateTime? GetDateTimeSafe(JsonElement el, string propertyName)
        {
            if (el.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String && prop.TryGetDateTime(out var val))
            {
                return val;
            }
            return null;
        }

        public async Task<GitHubRepoInfoDto> GetRepoInfoAsync(string owner, string repo, string? token = null)
        {
            var cacheKey = $"gh_repo_{owner}_{repo}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out GitHubRepoInfoDto? cached) && cached != null)
            {
                return cached;
            }

            using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}", token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("GitHub API error fetching repo {Owner}/{Repo}: {StatusCode} {Error}", owner, repo, res.StatusCode, err);
                if (res.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    throw new KeyNotFoundException($"Репозиторій '{owner}/{repo}' не знайдено або він є приватним.");
                }
                throw new HttpRequestException($"Помилка GitHub API: {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;

            string repoOwner = owner;
            if (root.TryGetProperty("owner", out var ow) && ow.ValueKind == JsonValueKind.Object)
            {
                repoOwner = GetStringSafe(ow, "login") ?? owner;
            }

            var dto = new GitHubRepoInfoDto
            {
                Owner = repoOwner,
                Name = GetStringSafe(root, "name") ?? repo,
                FullName = GetStringSafe(root, "full_name") ?? $"{owner}/{repo}",
                Description = GetStringSafe(root, "description") ?? "",
                DefaultBranch = GetStringSafe(root, "default_branch") ?? "main",
                StarsCount = GetInt32Safe(root, "stargazers_count"),
                ForksCount = GetInt32Safe(root, "forks_count"),
                OpenIssuesCount = GetInt32Safe(root, "open_issues_count"),
                HtmlUrl = GetStringSafe(root, "html_url") ?? $"https://github.com/{owner}/{repo}",
                IsPrivate = root.TryGetProperty("private", out var priv) && priv.ValueKind == JsonValueKind.True,
                Language = GetStringSafe(root, "language") ?? "",
                UpdatedAt = GetDateTimeSafe(root, "updated_at")
            };

            _cache.Set(cacheKey, dto, DefaultCacheDuration);
            return dto;
        }

        public async Task<List<GitHubBranchDto>> GetBranchesAsync(string owner, string repo, string? token = null)
        {
            var cacheKey = $"gh_branches_{owner}_{repo}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out List<GitHubBranchDto>? cached) && cached != null)
            {
                return cached;
            }

            var repoInfo = await GetRepoInfoAsync(owner, repo, token);

            using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/branches?per_page=100", token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Помилка завантаження гілок: {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var list = new List<GitHubBranchDto>();

            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var name = GetStringSafe(el, "name") ?? "";
                    string sha = "";
                    if (el.TryGetProperty("commit", out var cObj) && cObj.ValueKind == JsonValueKind.Object)
                    {
                        sha = GetStringSafe(cObj, "sha") ?? "";
                    }
                    var isProtected = el.TryGetProperty("protected", out var p) && p.ValueKind == JsonValueKind.True;

                    list.Add(new GitHubBranchDto
                    {
                        Name = name,
                        CommitSha = sha,
                        IsDefault = string.Equals(name, repoInfo.DefaultBranch, StringComparison.OrdinalIgnoreCase),
                        Protected = isProtected
                    });
                }
            }

            // Put default branch first
            list = list.OrderByDescending(b => b.IsDefault).ThenBy(b => b.Name).ToList();

            _cache.Set(cacheKey, list, DefaultCacheDuration);
            return list;
        }

        public async Task<List<GitHubTreeItemDto>> GetTreeOrContentsAsync(string owner, string repo, string branch, string? path = null, string? token = null)
        {
            var p = path?.Trim().Trim('/') ?? "";
            var cacheKey = $"gh_tree_{owner}_{repo}_{branch}_{p}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out List<GitHubTreeItemDto>? cached) && cached != null)
            {
                return cached;
            }

            // Using contents API: /repos/{owner}/{repo}/contents/{path}?ref={branch}
            var endpoint = string.IsNullOrEmpty(p)
                ? $"repos/{owner}/{repo}/contents?ref={Uri.EscapeDataString(branch)}"
                : $"repos/{owner}/{repo}/contents/{p}?ref={Uri.EscapeDataString(branch)}";

            using var req = CreateRequest(HttpMethod.Get, endpoint, token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Помилка завантаження файлів ({p}): {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var list = new List<GitHubTreeItemDto>();

            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var itemType = GetStringSafe(el, "type") ?? "file";
                    var isDir = itemType == "dir";

                    list.Add(new GitHubTreeItemDto
                    {
                        Path = GetStringSafe(el, "path") ?? "",
                        Type = isDir ? "tree" : "blob",
                        Sha = GetStringSafe(el, "sha") ?? "",
                        Size = GetInt64Safe(el, "size"),
                        Url = GetStringSafe(el, "html_url") ?? ""
                    });
                }
            }

            // Sort directories first, then alphabetically
            list = list.OrderByDescending(i => i.Type == "tree").ThenBy(i => i.Path).ToList();

            _cache.Set(cacheKey, list, DefaultCacheDuration);
            return list;
        }

        public async Task<GitHubFileContentDto> GetFileContentAsync(string owner, string repo, string path, string branch, string? token = null)
        {
            var p = path.Trim().Trim('/');
            var cacheKey = $"gh_file_{owner}_{repo}_{branch}_{p}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out GitHubFileContentDto? cached) && cached != null)
            {
                return cached;
            }

            var endpoint = $"repos/{owner}/{repo}/contents/{p}?ref={Uri.EscapeDataString(branch)}";
            using var req = CreateRequest(HttpMethod.Get, endpoint, token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Не вдалося відкрити файл '{p}': {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;

            var name = GetStringSafe(root, "name") ?? Path.GetFileName(p);
            var sha = GetStringSafe(root, "sha") ?? "";
            var size = GetInt64Safe(root, "size") ?? 0;
            var htmlUrl = GetStringSafe(root, "html_url") ?? "";
            var downloadUrl = GetStringSafe(root, "download_url") ?? "";

            var isBinary = IsBinaryFile(name);
            string contentText = "";

            if (!isBinary && root.TryGetProperty("content", out var contentProp) && contentProp.ValueKind == JsonValueKind.String)
            {
                var rawBase64 = contentProp.GetString() ?? "";
                // Base64 from GitHub can have \n breaks
                rawBase64 = rawBase64.Replace("\n", "").Replace("\r", "");
                try
                {
                    var bytes = Convert.FromBase64String(rawBase64);
                    contentText = Encoding.UTF8.GetString(bytes);
                }
                catch
                {
                    contentText = "[Помилка декодування вмісту файлу]";
                }
            }
            else if (!isBinary && !string.IsNullOrEmpty(downloadUrl))
            {
                // Fetch raw download
                using var rawReq = CreateRequest(HttpMethod.Get, downloadUrl, token);
                using var rawRes = await _httpClient.SendAsync(rawReq);
                if (rawRes.IsSuccessStatusCode)
                {
                    contentText = await rawRes.Content.ReadAsStringAsync();
                }
            }

            var ext = Path.GetExtension(name).ToLowerInvariant();
            var linesCount = string.IsNullOrEmpty(contentText) ? 0 : contentText.Split('\n').Length;

            var dto = new GitHubFileContentDto
            {
                Name = name,
                Path = p,
                Sha = sha,
                Size = size,
                Content = contentText,
                Encoding = "utf-8",
                HtmlUrl = htmlUrl,
                DownloadUrl = downloadUrl,
                Language = DetectLanguage(ext),
                TotalLines = linesCount,
                IsBinary = isBinary
            };

            _cache.Set(cacheKey, dto, DefaultCacheDuration);
            return dto;
        }

        public async Task<List<GitHubCommitDto>> GetCommitsAsync(string owner, string repo, string? branch = null, int page = 1, int pageSize = 10, string? token = null)
        {
            var p = Math.Max(1, page);
            var ps = Math.Clamp(pageSize, 1, 100);
            var cacheKey = $"gh_commits_{owner}_{repo}_{branch}_{p}_{ps}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out List<GitHubCommitDto>? cached) && cached != null)
            {
                return cached;
            }

            var endpoint = $"repos/{owner}/{repo}/commits?page={p}&per_page={ps}";
            if (!string.IsNullOrWhiteSpace(branch))
            {
                endpoint += $"&sha={Uri.EscapeDataString(branch)}";
            }

            using var req = CreateRequest(HttpMethod.Get, endpoint, token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Помилка завантаження комітів: {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var list = new List<GitHubCommitDto>();

            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var sha = GetStringSafe(el, "sha") ?? "";
                    string message = "";
                    string authorName = "Unknown";
                    string authorEmail = "";
                    DateTime date = DateTime.UtcNow;

                    if (el.TryGetProperty("commit", out var commitObj) && commitObj.ValueKind == JsonValueKind.Object)
                    {
                        message = GetStringSafe(commitObj, "message") ?? "";
                        if (commitObj.TryGetProperty("author", out var authorObj) && authorObj.ValueKind == JsonValueKind.Object)
                        {
                            authorName = GetStringSafe(authorObj, "name") ?? "Unknown";
                            authorEmail = GetStringSafe(authorObj, "email") ?? "";
                            date = GetDateTimeSafe(authorObj, "date") ?? DateTime.UtcNow;
                        }
                    }

                    string? avatarUrl = null;
                    if (el.TryGetProperty("author", out var ghAuthor) && ghAuthor.ValueKind == JsonValueKind.Object)
                    {
                        avatarUrl = GetStringSafe(ghAuthor, "avatar_url");
                    }

                    var htmlUrl = GetStringSafe(el, "html_url") ?? "";

                    list.Add(new GitHubCommitDto
                    {
                        Sha = sha,
                        Message = message,
                        AuthorName = authorName,
                        AuthorEmail = authorEmail,
                        AuthorAvatarUrl = avatarUrl,
                        Date = date,
                        HtmlUrl = htmlUrl
                    });
                }
            }

            _cache.Set(cacheKey, list, DefaultCacheDuration);
            return list;
        }

        public async Task<GitHubCommitDto> GetCommitDetailsAsync(string owner, string repo, string sha, string? token = null)
        {
            var cacheKey = $"gh_commit_{owner}_{repo}_{sha}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out GitHubCommitDto? cached) && cached != null)
            {
                return cached;
            }

            using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/commits/{sha}", token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Помилка отримання деталей коміту {sha}: {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;

            string message = "";
            string authorName = "Unknown";
            string authorEmail = "";
            DateTime date = DateTime.UtcNow;

            if (root.TryGetProperty("commit", out var commitObj) && commitObj.ValueKind == JsonValueKind.Object)
            {
                message = GetStringSafe(commitObj, "message") ?? "";
                if (commitObj.TryGetProperty("author", out var authorObj) && authorObj.ValueKind == JsonValueKind.Object)
                {
                    authorName = GetStringSafe(authorObj, "name") ?? "Unknown";
                    authorEmail = GetStringSafe(authorObj, "email") ?? "";
                    date = GetDateTimeSafe(authorObj, "date") ?? DateTime.UtcNow;
                }
            }

            string? avatarUrl = null;
            if (root.TryGetProperty("author", out var ghAuthor) && ghAuthor.ValueKind == JsonValueKind.Object)
            {
                avatarUrl = GetStringSafe(ghAuthor, "avatar_url");
            }

            var htmlUrl = GetStringSafe(root, "html_url") ?? "";

            int additions = 0, deletions = 0, total = 0;
            if (root.TryGetProperty("stats", out var stats) && stats.ValueKind == JsonValueKind.Object)
            {
                additions = GetInt32Safe(stats, "additions");
                deletions = GetInt32Safe(stats, "deletions");
                total = GetInt32Safe(stats, "total");
            }

            var dto = new GitHubCommitDto
            {
                Sha = sha,
                Message = message,
                AuthorName = authorName,
                AuthorEmail = authorEmail,
                AuthorAvatarUrl = avatarUrl,
                Date = date,
                HtmlUrl = htmlUrl,
                Additions = additions,
                Deletions = deletions,
                TotalChanges = total
            };

            _cache.Set(cacheKey, dto, DefaultCacheDuration);
            return dto;
        }

        public async Task<List<GitHubPullRequestDto>> GetPullRequestsAsync(Guid projectId, string owner, string repo, string state = "all", int page = 1, int pageSize = 10, string? token = null)
        {
            var p = Math.Max(1, page);
            var ps = Math.Clamp(pageSize, 1, 100);
            var cacheKey = $"gh_prs_{owner}_{repo}_{state}_{p}_{ps}".ToLowerInvariant();
            if (!_cache.TryGetValue(cacheKey, out List<GitHubPullRequestDto>? list) || list == null)
            {
                using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/pulls?state={state}&page={p}&per_page={ps}", token);
                using var res = await _httpClient.SendAsync(req);

                if (!res.IsSuccessStatusCode)
                {
                    throw new HttpRequestException($"Помилка завантаження Pull Requests: {res.StatusCode}");
                }

                using var stream = await res.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);
                list = new List<GitHubPullRequestDto>();

                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in doc.RootElement.EnumerateArray())
                    {
                        var number = GetInt32Safe(el, "number");
                        var title = GetStringSafe(el, "title") ?? $"PR #{number}";
                        var prState = GetStringSafe(el, "state") ?? "open";
                        var body = GetStringSafe(el, "body") ?? "";
                        var htmlUrl = GetStringSafe(el, "html_url") ?? $"https://github.com/{owner}/{repo}/pull/{number}";

                        string userLogin = "Unknown";
                        string? userAvatar = null;
                        if (el.TryGetProperty("user", out var userObj) && userObj.ValueKind == JsonValueKind.Object)
                        {
                            userLogin = GetStringSafe(userObj, "login") ?? "Unknown";
                            userAvatar = GetStringSafe(userObj, "avatar_url");
                        }

                        var createdAt = GetDateTimeSafe(el, "created_at") ?? DateTime.UtcNow;
                        var updatedAt = GetDateTimeSafe(el, "updated_at");
                        var closedAt = GetDateTimeSafe(el, "closed_at");
                        var mergedAt = GetDateTimeSafe(el, "merged_at");

                        string headRef = "";
                        if (el.TryGetProperty("head", out var headObj) && headObj.ValueKind == JsonValueKind.Object)
                        {
                            headRef = GetStringSafe(headObj, "ref") ?? "";
                        }

                        string baseRef = "";
                        if (el.TryGetProperty("base", out var baseObj) && baseObj.ValueKind == JsonValueKind.Object)
                        {
                            baseRef = GetStringSafe(baseObj, "ref") ?? "";
                        }

                        list.Add(new GitHubPullRequestDto
                        {
                            Number = number,
                            Title = title,
                            State = prState,
                            Body = body,
                            HtmlUrl = htmlUrl,
                            UserLogin = userLogin,
                            UserAvatarUrl = userAvatar,
                            CreatedAt = createdAt,
                            UpdatedAt = updatedAt,
                            ClosedAt = closedAt,
                            MergedAt = mergedAt,
                            HeadRef = headRef,
                            BaseRef = baseRef,
                            Approvals = new()
                        });
                    }
                }

                _cache.Set(cacheKey, list, DefaultCacheDuration);
            }

            // Enrich PRs with local approvals and cached comments count
            try
            {
                var projectApprovals = await _db.ProjectPullRequestApprovals
                    .AsNoTracking()
                    .Where(a => a.TeamProjectId == projectId)
                    .OrderByDescending(a => a.ApprovedAt)
                    .ToListAsync();

                var approvalsByPr = projectApprovals
                    .GroupBy(a => a.PullNumber)
                    .ToDictionary(g => g.Key, g => g.Select(a => new PullRequestApprovalDto
                    {
                        Id = a.Id,
                        PullNumber = a.PullNumber,
                        UserId = a.UserId,
                        UserNickname = a.UserNickname,
                        UserFullName = a.UserFullName,
                        UserAvatarPath = a.UserAvatarPath,
                        Comment = a.Comment,
                        ApprovedAt = a.ApprovedAt,
                        SyncedToGitHub = a.SyncedToGitHub
                    }).ToList());

                foreach (var prItem in list)
                {
                    if (approvalsByPr.TryGetValue(prItem.Number, out var appList))
                    {
                        prItem.Approvals = appList;
                        prItem.IsApproved = appList.Any();
                        prItem.CommentsCount += appList.Count(a => !string.IsNullOrWhiteSpace(a.Comment));
                    }

                    // If full PR details or comments were cached, reflect their counts
                    var detailCacheKey = $"gh_pr_{owner}_{repo}_{prItem.Number}".ToLowerInvariant();
                    if (_cache.TryGetValue(detailCacheKey, out GitHubPullRequestDto? cachedPr) && cachedPr != null)
                    {
                        prItem.CommentsCount = cachedPr.CommentsCount;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to enrich PRs with approvals for project {ProjectId}", projectId);
            }

            return list;
        }

        public async Task<GitHubPullRequestDto> GetPullRequestDetailsAsync(Guid projectId, string owner, string repo, int pullNumber, string? token = null)
        {
            var cacheKey = $"gh_pr_{owner}_{repo}_{pullNumber}".ToLowerInvariant();
            if (!_cache.TryGetValue(cacheKey, out GitHubPullRequestDto? pr) || pr == null)
            {
                using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/pulls/{pullNumber}", token);
                using var res = await _httpClient.SendAsync(req);

                if (!res.IsSuccessStatusCode)
                {
                    throw new HttpRequestException($"Помилка завантаження PR #{pullNumber}: {res.StatusCode}");
                }

                using var stream = await res.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);
                var el = doc.RootElement;

                var number = GetInt32Safe(el, "number", pullNumber);
                var title = GetStringSafe(el, "title") ?? $"PR #{number}";
                var prState = GetStringSafe(el, "state") ?? "open";
                var body = GetStringSafe(el, "body") ?? "";
                var htmlUrl = GetStringSafe(el, "html_url") ?? $"https://github.com/{owner}/{repo}/pull/{number}";

                string userLogin = "Unknown";
                string? userAvatar = null;
                if (el.TryGetProperty("user", out var userObj) && userObj.ValueKind == JsonValueKind.Object)
                {
                    userLogin = GetStringSafe(userObj, "login") ?? "Unknown";
                    userAvatar = GetStringSafe(userObj, "avatar_url");
                }

                var createdAt = GetDateTimeSafe(el, "created_at") ?? DateTime.UtcNow;
                var updatedAt = GetDateTimeSafe(el, "updated_at");
                var closedAt = GetDateTimeSafe(el, "closed_at");
                var mergedAt = GetDateTimeSafe(el, "merged_at");

                string headRef = "";
                if (el.TryGetProperty("head", out var headObj) && headObj.ValueKind == JsonValueKind.Object)
                {
                    headRef = GetStringSafe(headObj, "ref") ?? "";
                }

                string baseRef = "";
                if (el.TryGetProperty("base", out var baseObj) && baseObj.ValueKind == JsonValueKind.Object)
                {
                    baseRef = GetStringSafe(baseObj, "ref") ?? "";
                }

                int additions = GetInt32Safe(el, "additions");
                int deletions = GetInt32Safe(el, "deletions");
                int changedFiles = GetInt32Safe(el, "changed_files");
                int comments = GetInt32Safe(el, "comments");
                int reviewComments = GetInt32Safe(el, "review_comments");
                int totalComments = comments + reviewComments;

                pr = new GitHubPullRequestDto
                {
                    Number = number,
                    Title = title,
                    State = prState,
                    Body = body,
                    HtmlUrl = htmlUrl,
                    UserLogin = userLogin,
                    UserAvatarUrl = userAvatar,
                    CreatedAt = createdAt,
                    UpdatedAt = updatedAt,
                    ClosedAt = closedAt,
                    MergedAt = mergedAt,
                    HeadRef = headRef,
                    BaseRef = baseRef,
                    Additions = additions,
                    Deletions = deletions,
                    ChangedFiles = changedFiles,
                    CommentsCount = totalComments,
                    Approvals = new()
                };

                _cache.Set(cacheKey, pr, DefaultCacheDuration);
            }

            // Always load latest approvals for project
            try
            {
                var approvals = await _db.ProjectPullRequestApprovals
                    .AsNoTracking()
                    .Where(a => a.TeamProjectId == projectId && a.PullNumber == pullNumber)
                    .OrderByDescending(a => a.ApprovedAt)
                    .Select(a => new PullRequestApprovalDto
                    {
                        Id = a.Id,
                        PullNumber = a.PullNumber,
                        UserId = a.UserId,
                        UserNickname = a.UserNickname,
                        UserFullName = a.UserFullName,
                        UserAvatarPath = a.UserAvatarPath,
                        Comment = a.Comment,
                        ApprovedAt = a.ApprovedAt,
                        SyncedToGitHub = a.SyncedToGitHub
                    })
                    .ToListAsync();

                pr.Approvals = approvals;
                pr.IsApproved = approvals.Any();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load approvals for PR #{PullNumber}", pullNumber);
            }

            return pr;
        }

        public async Task<List<GitHubPullRequestCommentDto>> GetPullRequestCommentsAsync(Guid projectId, string owner, string repo, int pullNumber, string? token = null)
        {
            var cacheKey = $"gh_pr_comments_{owner}_{repo}_{pullNumber}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out List<GitHubPullRequestCommentDto>? cached) && cached != null)
            {
                return cached;
            }

            var result = new List<GitHubPullRequestCommentDto>();

            // 1. Fetch Issue comments (timeline comments on the PR)
            try
            {
                using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/issues/{pullNumber}/comments?per_page=100", token);
                using var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    using var stream = await res.Content.ReadAsStreamAsync();
                    using var doc = await JsonDocument.ParseAsync(stream);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            long id = el.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.Number ? idProp.GetInt64() : 0;
                            string body = GetStringSafe(el, "body") ?? "";
                            var createdAt = GetDateTimeSafe(el, "created_at") ?? DateTime.UtcNow;
                            var updatedAt = GetDateTimeSafe(el, "updated_at");
                            string? htmlUrl = GetStringSafe(el, "html_url");
                            string? authorAssoc = GetStringSafe(el, "author_association");

                            string userLogin = "Unknown";
                            string? userAvatar = null;
                            if (el.TryGetProperty("user", out var userObj) && userObj.ValueKind == JsonValueKind.Object)
                            {
                                userLogin = GetStringSafe(userObj, "login") ?? "Unknown";
                                userAvatar = GetStringSafe(userObj, "avatar_url");
                            }

                            result.Add(new GitHubPullRequestCommentDto
                            {
                                Id = id,
                                UserLogin = userLogin,
                                UserAvatarUrl = userAvatar,
                                Body = body,
                                CreatedAt = createdAt,
                                UpdatedAt = updatedAt,
                                HtmlUrl = htmlUrl,
                                AuthorAssociation = authorAssoc,
                                IsReviewComment = false
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch issue comments for PR #{PullNumber}", pullNumber);
            }

            // 2. Fetch Review comments (diff / inline code comments)
            try
            {
                using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/pulls/{pullNumber}/comments?per_page=100", token);
                using var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    using var stream = await res.Content.ReadAsStreamAsync();
                    using var doc = await JsonDocument.ParseAsync(stream);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            long id = el.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.Number ? idProp.GetInt64() : 0;
                            string body = GetStringSafe(el, "body") ?? "";
                            var createdAt = GetDateTimeSafe(el, "created_at") ?? DateTime.UtcNow;
                            var updatedAt = GetDateTimeSafe(el, "updated_at");
                            string? htmlUrl = GetStringSafe(el, "html_url");
                            string? authorAssoc = GetStringSafe(el, "author_association");
                            string? path = GetStringSafe(el, "path");
                            int? line = el.TryGetProperty("line", out var lineProp) && lineProp.ValueKind == JsonValueKind.Number
                                ? lineProp.GetInt32()
                                : (el.TryGetProperty("original_line", out var origLineProp) && origLineProp.ValueKind == JsonValueKind.Number ? origLineProp.GetInt32() : (int?)null);
                            string? diffHunk = GetStringSafe(el, "diff_hunk");

                            string userLogin = "Unknown";
                            string? userAvatar = null;
                            if (el.TryGetProperty("user", out var userObj) && userObj.ValueKind == JsonValueKind.Object)
                            {
                                userLogin = GetStringSafe(userObj, "login") ?? "Unknown";
                                userAvatar = GetStringSafe(userObj, "avatar_url");
                            }

                            result.Add(new GitHubPullRequestCommentDto
                            {
                                Id = id,
                                UserLogin = userLogin,
                                UserAvatarUrl = userAvatar,
                                Body = body,
                                CreatedAt = createdAt,
                                UpdatedAt = updatedAt,
                                HtmlUrl = htmlUrl,
                                AuthorAssociation = authorAssoc,
                                IsReviewComment = true,
                                Path = path,
                                Line = line,
                                DiffHunk = diffHunk
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch review comments for PR #{PullNumber}", pullNumber);
            }

            // 3. Include local team approval comments if any
            try
            {
                var localApprovals = await _db.ProjectPullRequestApprovals
                    .AsNoTracking()
                    .Where(a => a.TeamProjectId == projectId && a.PullNumber == pullNumber && !string.IsNullOrWhiteSpace(a.Comment))
                    .ToListAsync();

                foreach (var app in localApprovals)
                {
                    result.Add(new GitHubPullRequestCommentDto
                    {
                        Id = Math.Abs(app.Id.GetHashCode()),
                        UserLogin = app.UserNickname,
                        UserAvatarUrl = app.UserAvatarPath,
                        Body = $"✅ **{app.UserFullName} (@{app.UserNickname}) схвалив(ла) цей MR**:\n\n{app.Comment}",
                        CreatedAt = app.ApprovedAt,
                        UpdatedAt = null,
                        HtmlUrl = null,
                        AuthorAssociation = "Team Member",
                        IsReviewComment = false
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load local approval comments for PR #{PullNumber}", pullNumber);
            }

            result = result.OrderBy(c => c.CreatedAt).ToList();
            _cache.Set(cacheKey, result, TimeSpan.FromSeconds(30));
            return result;
        }

        public async Task<GitHubPullRequestCommentDto> AddPullRequestCommentAsync(
            Guid projectId,
            string owner,
            string repo,
            int pullNumber,
            string body,
            string? token = null,
            string? authorNickname = null,
            string? authorFullName = null,
            string? authorAvatar = null)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                throw new ArgumentException("Текст коментаря не може бути порожнім.");
            }

            GitHubPullRequestCommentDto? postedComment = null;
            var effectiveToken = !string.IsNullOrWhiteSpace(token) ? token : _config["GitHub:Token"];

            // Try posting to GitHub if token is configured
            if (!string.IsNullOrWhiteSpace(effectiveToken))
            {
                try
                {
                    using var req = CreateRequest(HttpMethod.Post, $"repos/{owner}/{repo}/issues/{pullNumber}/comments", effectiveToken);
                    req.Content = new StringContent(JsonSerializer.Serialize(new { body = body }), Encoding.UTF8, "application/json");

                    using var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        using var stream = await res.Content.ReadAsStreamAsync();
                        using var doc = await JsonDocument.ParseAsync(stream);
                        var el = doc.RootElement;

                        long id = el.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.Number ? idProp.GetInt64() : 0;
                        string retBody = GetStringSafe(el, "body") ?? body;
                        var createdAt = GetDateTimeSafe(el, "created_at") ?? DateTime.UtcNow;
                        string? htmlUrl = GetStringSafe(el, "html_url");

                        string userLogin = authorNickname ?? "You";
                        string? userAvatar = authorAvatar;
                        if (el.TryGetProperty("user", out var userObj) && userObj.ValueKind == JsonValueKind.Object)
                        {
                            userLogin = GetStringSafe(userObj, "login") ?? userLogin;
                            userAvatar = GetStringSafe(userObj, "avatar_url") ?? userAvatar;
                        }

                        postedComment = new GitHubPullRequestCommentDto
                        {
                            Id = id,
                            UserLogin = userLogin,
                            UserAvatarUrl = userAvatar,
                            Body = retBody,
                            CreatedAt = createdAt,
                            HtmlUrl = htmlUrl,
                            AuthorAssociation = "Collaborator",
                            IsReviewComment = false
                        };
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Posting comment to GitHub failed: {Message}", ex.Message);
                }
            }

            if (postedComment == null)
            {
                // Fallback: save as a local team comment
                postedComment = new GitHubPullRequestCommentDto
                {
                    Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    UserLogin = authorNickname ?? "Користувач",
                    UserAvatarUrl = authorAvatar,
                    Body = body,
                    CreatedAt = DateTime.UtcNow,
                    HtmlUrl = null,
                    AuthorAssociation = "Team Member",
                    IsReviewComment = false
                };
            }

            // Invalidate cache
            _cache.Remove($"gh_pr_comments_{owner}_{repo}_{pullNumber}".ToLowerInvariant());
            _cache.Remove($"gh_pr_{owner}_{repo}_{pullNumber}".ToLowerInvariant());

            return postedComment;
        }

        public async Task<PullRequestApprovalDto> ApprovePullRequestAsync(
            Guid projectId,
            string owner,
            string repo,
            int pullNumber,
            Guid userId,
            string userNickname,
            string userFullName,
            string? userAvatar = null,
            string? comment = null,
            string? token = null)
        {
            var existing = await _db.ProjectPullRequestApprovals
                .FirstOrDefaultAsync(a => a.TeamProjectId == projectId && a.PullNumber == pullNumber && a.UserId == userId);

            if (existing != null)
            {
                existing.Comment = comment;
                existing.ApprovedAt = DateTime.UtcNow;
            }
            else
            {
                existing = new ProjectPullRequestApproval
                {
                    TeamProjectId = projectId,
                    PullNumber = pullNumber,
                    UserId = userId,
                    UserNickname = userNickname,
                    UserFullName = userFullName,
                    UserAvatarPath = userAvatar,
                    Comment = comment,
                    ApprovedAt = DateTime.UtcNow,
                    SyncedToGitHub = false
                };
                _db.ProjectPullRequestApprovals.Add(existing);
            }

            var effectiveToken = !string.IsNullOrWhiteSpace(token) ? token : _config["GitHub:Token"];
            if (!string.IsNullOrWhiteSpace(effectiveToken))
            {
                try
                {
                    using var req = CreateRequest(HttpMethod.Post, $"repos/{owner}/{repo}/pulls/{pullNumber}/reviews", effectiveToken);
                    var payload = new
                    {
                        @event = "APPROVE",
                        body = !string.IsNullOrWhiteSpace(comment) ? comment : "Approved in LinqUp"
                    };
                    req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    using var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        existing.SyncedToGitHub = true;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to sync approval to GitHub for PR #{PullNumber}", pullNumber);
                }
            }

            await _db.SaveChangesAsync();

            // Invalidate caches
            _cache.Remove($"gh_pr_{owner}_{repo}_{pullNumber}".ToLowerInvariant());
            _cache.Remove($"gh_pr_comments_{owner}_{repo}_{pullNumber}".ToLowerInvariant());

            return new PullRequestApprovalDto
            {
                Id = existing.Id,
                PullNumber = existing.PullNumber,
                UserId = existing.UserId,
                UserNickname = existing.UserNickname,
                UserFullName = existing.UserFullName,
                UserAvatarPath = existing.UserAvatarPath,
                Comment = existing.Comment,
                ApprovedAt = existing.ApprovedAt,
                SyncedToGitHub = existing.SyncedToGitHub
            };
        }


        public async Task<List<GitHubPullRequestFileDto>> GetPullRequestFilesAsync(string owner, string repo, int pullNumber, string? token = null)
        {
            var cacheKey = $"gh_pr_files_{owner}_{repo}_{pullNumber}".ToLowerInvariant();
            if (_cache.TryGetValue(cacheKey, out List<GitHubPullRequestFileDto>? cached) && cached != null)
            {
                return cached;
            }

            using var req = CreateRequest(HttpMethod.Get, $"repos/{owner}/{repo}/pulls/{pullNumber}/files?per_page=100", token);
            using var res = await _httpClient.SendAsync(req);

            if (!res.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Помилка завантаження файлів для PR #{pullNumber}: {res.StatusCode}");
            }

            using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var list = new List<GitHubPullRequestFileDto>();

            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var sha = GetStringSafe(el, "sha") ?? "";
                    var filename = GetStringSafe(el, "filename") ?? "";
                    var status = GetStringSafe(el, "status") ?? "modified";
                    var additions = GetInt32Safe(el, "additions");
                    var deletions = GetInt32Safe(el, "deletions");
                    var changes = GetInt32Safe(el, "changes");
                    var patch = GetStringSafe(el, "patch") ?? "";
                    var rawUrl = GetStringSafe(el, "raw_url") ?? "";

                    list.Add(new GitHubPullRequestFileDto
                    {
                        Sha = sha,
                        Filename = filename,
                        Status = status,
                        Additions = additions,
                        Deletions = deletions,
                        Changes = changes,
                        Patch = patch,
                        RawUrl = rawUrl
                    });
                }
            }

            _cache.Set(cacheKey, list, DefaultCacheDuration);
            return list;
        }


        private static bool IsBinaryFile(string filename)
        {
            var ext = Path.GetExtension(filename).ToLowerInvariant();
            var binaryExts = new HashSet<string>
            {
                ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg",
                ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
                ".exe", ".dll", ".so", ".dylib", ".bin", ".iso",
                ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".avi", ".mov",
                ".woff", ".woff2", ".ttf", ".eot"
            };
            return binaryExts.Contains(ext);
        }

        private static string DetectLanguage(string extension)
        {
            return extension switch
            {
                ".cs" => "csharp",
                ".js" => "javascript",
                ".jsx" => "javascript",
                ".ts" => "typescript",
                ".tsx" => "typescript",
                ".py" => "python",
                ".html" or ".htm" => "html",
                ".css" => "css",
                ".scss" or ".sass" => "scss",
                ".json" => "json",
                ".md" => "markdown",
                ".xml" => "xml",
                ".sql" => "sql",
                ".sh" or ".bash" => "bash",
                ".ps1" => "powershell",
                ".java" => "java",
                ".cpp" or ".cc" or ".cxx" => "cpp",
                ".c" or ".h" => "c",
                ".go" => "go",
                ".rs" => "rust",
                ".php" => "php",
                ".rb" => "ruby",
                ".yaml" or ".yml" => "yaml",
                ".dockerfile" => "dockerfile",
                _ => "plaintext"
            };
        }
    }
}
