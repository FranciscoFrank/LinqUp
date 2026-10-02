namespace LinqUp.API.Services
{
    public class AvatarStorageService : IAvatarStorageService
    {
        private const long MaxSizeBytes = 5 * 1024 * 1024;

        private static readonly Dictionary<string, string> AllowedContentTypes = new()
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp"
        };

        private readonly IWebHostEnvironment _env;

        public AvatarStorageService(IWebHostEnvironment env)
        {
            _env = env;
        }

        public async Task<(string? path, string? error)> SaveAsync(Guid userId, IFormFile file)
        {
            if (file.Length == 0)
            {
                return (null, "Файл порожній.");
            }

            if (file.Length > MaxSizeBytes)
            {
                return (null, "Файл завеликий (максимум 5 МБ).");
            }

            if (!AllowedContentTypes.TryGetValue(file.ContentType, out var extension))
            {
                return (null, "Дозволені формати: JPEG, PNG, WEBP.");
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var avatarsDir = Path.Combine(webRoot, "uploads", "avatars");
            Directory.CreateDirectory(avatarsDir);

            foreach (var existing in Directory.EnumerateFiles(avatarsDir, $"{userId}.*"))
            {
                File.Delete(existing);
            }

            var fileName = $"{userId}{extension}";
            var fullPath = Path.Combine(avatarsDir, fileName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return ($"/uploads/avatars/{fileName}", null);
        }

        public void Delete(string? avatarPath)
        {
            if (string.IsNullOrWhiteSpace(avatarPath))
            {
                return;
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var avatarsDir = Path.GetFullPath(Path.Combine(webRoot, "uploads", "avatars"));
            
            var relativePath = avatarPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.GetFullPath(Path.Combine(webRoot, relativePath));

            if (!fullPath.StartsWith(avatarsDir, StringComparison.OrdinalIgnoreCase))
            {
                return; // Prevent Path Traversal
            }

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
    }
}
