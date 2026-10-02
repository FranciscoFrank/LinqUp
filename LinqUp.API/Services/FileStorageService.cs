using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using LinqUp.Shared;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;

namespace LinqUp.API.Services
{
    public class FileStorageService : IFileStorageService
    {
        private const long MaxImageSizeBytes = 15 * 1024 * 1024; // 15 MB
        private const long MaxFileSizeBytes = 50 * 1024 * 1024;  // 50 MB

        private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"
        };

        private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".exe", ".dll", ".bat", ".cmd", ".vbs", ".ps1", ".com", ".scr", ".msi"
        };

        private static readonly FileExtensionContentTypeProvider MimeProvider = new();

        private readonly IWebHostEnvironment _env;

        public FileStorageService(IWebHostEnvironment env)
        {
            _env = env;
        }

        private string GetProjectUploadsDir(Guid projectId)
        {
            // Store outside wwwroot to prevent unauthorized direct HTTP access
            var rootDir = Path.Combine(_env.ContentRootPath, "App_Data", "uploads", "projects", projectId.ToString("N"));
            Directory.CreateDirectory(rootDir);
            return rootDir;
        }

        public async Task<(MessageAttachment? attachment, string? error)> SaveAttachmentAsync(Guid projectId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return (null, "Файл порожній.");
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (BlockedExtensions.Contains(extension))
            {
                return (null, "Виконавчі файли заборонені для надсилання з міркувань безпеки.");
            }

            var isImage = ImageExtensions.Contains(extension);
            var maxAllowedSize = isImage ? MaxImageSizeBytes : MaxFileSizeBytes;

            if (file.Length > maxAllowedSize)
            {
                var limitMb = maxAllowedSize / (1024 * 1024);
                return (null, $"Розмір файлу перевищує ліміт у {limitMb} МБ.");
            }

            if (!MimeProvider.TryGetContentType(file.FileName, out var contentType))
            {
                contentType = file.ContentType;
                if (string.IsNullOrWhiteSpace(contentType))
                {
                    contentType = isImage ? "image/png" : "application/octet-stream";
                }
            }

            var attachmentId = Guid.CreateVersion7();
            // Store with a safe GUID-based filename on disk to avoid traversal or execution
            var storageFileName = $"{attachmentId:N}.dat";
            var uploadsDir = GetProjectUploadsDir(projectId);
            var targetFilePath = Path.Combine(uploadsDir, storageFileName);

            // Clean original filename from illegal path characters while preserving original extension & unicode
            var sanitizedOriginalFileName = Path.GetFileName(file.FileName);
            if (string.IsNullOrWhiteSpace(sanitizedOriginalFileName))
            {
                sanitizedOriginalFileName = $"file_{attachmentId:N}{extension}";
            }

            // Stream directly in binary mode without text transformations to preserve exact bytes
            await using (var outputStream = new FileStream(targetFilePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 81920, useAsync: true))
            {
                await file.CopyToAsync(outputStream);
            }

            var attachment = new MessageAttachment
            {
                Id = attachmentId,
                OriginalFileName = sanitizedOriginalFileName,
                StorageFileName = storageFileName,
                ContentType = contentType,
                FileSize = file.Length,
                IsImage = isImage,
                UploadedAt = DateTime.UtcNow
            };

            return (attachment, null);
        }

        public string? GetPhysicalFilePath(Guid projectId, string storageFileName)
        {
            if (string.IsNullOrWhiteSpace(storageFileName))
            {
                return null;
            }

            var uploadsDir = Path.GetFullPath(GetProjectUploadsDir(projectId));
            var fullPath = Path.GetFullPath(Path.Combine(uploadsDir, Path.GetFileName(storageFileName)));

            // Prevent path traversal outside project upload dir
            if (!fullPath.StartsWith(uploadsDir, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return File.Exists(fullPath) ? fullPath : null;
        }

        public void DeleteAttachmentFile(Guid projectId, string storageFileName)
        {
            var path = GetPhysicalFilePath(projectId, storageFileName);
            if (path != null && File.Exists(path))
            {
                try
                {
                    File.Delete(path);
                }
                catch
                {
                    // Ignore deletion errors for transient files
                }
            }
        }
    }
}
