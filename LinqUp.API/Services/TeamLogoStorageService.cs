using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace LinqUp.API.Services
{
    public class TeamLogoStorageService : ITeamLogoStorageService
    {
        private const long MaxSizeBytes = 5 * 1024 * 1024;
        private const int MaxDimension = 512;

        private static readonly Dictionary<string, string> AllowedContentTypes = new()
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp"
        };

        private readonly IWebHostEnvironment _env;

        public TeamLogoStorageService(IWebHostEnvironment env)
        {
            _env = env;
        }

        public async Task<(string? path, string? error)> SaveAsync(Guid projectId, IFormFile file)
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

            // Inspect binary dimensions
            await using (var testStream = file.OpenReadStream())
            {
                var dimensions = TryGetImageDimensions(testStream, extension);
                if (dimensions.HasValue)
                {
                    var (width, height) = dimensions.Value;
                    if (width > MaxDimension || height > MaxDimension)
                    {
                        return (null, $"Розмір логотипу не може перевищувати {MaxDimension}x{MaxDimension} px (завантажено {width}x{height} px).");
                    }

                    if (Math.Abs(width - height) > 4) // Allowing tiny rounding difference if any
                    {
                        return (null, $"Логотип має бути квадратним (зараз {width}x{height} px). Будь ласка, обріжте до квадрата.");
                    }
                }
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var logosDir = Path.Combine(webRoot, "uploads", "teams");
            Directory.CreateDirectory(logosDir);

            // Remove existing project logo files
            foreach (var existing in Directory.EnumerateFiles(logosDir, $"{projectId}.*"))
            {
                try { File.Delete(existing); } catch { }
            }

            var fileName = $"{projectId}{extension}";
            var fullPath = Path.Combine(logosDir, fileName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return ($"/uploads/teams/{fileName}", null);
        }

        public void Delete(string? logoPath)
        {
            if (string.IsNullOrWhiteSpace(logoPath))
            {
                return;
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var logosDir = Path.GetFullPath(Path.Combine(webRoot, "uploads", "teams"));

            var relativePath = logoPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.GetFullPath(Path.Combine(webRoot, relativePath));

            if (!fullPath.StartsWith(logosDir, StringComparison.OrdinalIgnoreCase))
            {
                return; // Prevent Path Traversal
            }

            if (File.Exists(fullPath))
            {
                try { File.Delete(fullPath); } catch { }
            }
        }

        private static (int Width, int Height)? TryGetImageDimensions(Stream stream, string extension)
        {
            try
            {
                using var reader = new BinaryReader(stream, System.Text.Encoding.Default, leaveOpen: true);
                if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase))
                {
                    // PNG header: 8 bytes magic + 4 bytes length + 4 bytes 'IHDR' + 4 bytes width + 4 bytes height
                    if (stream.Length < 24) return null;
                    stream.Seek(16, SeekOrigin.Begin);
                    var widthBytes = reader.ReadBytes(4);
                    var heightBytes = reader.ReadBytes(4);
                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(widthBytes);
                        Array.Reverse(heightBytes);
                    }
                    var width = BitConverter.ToInt32(widthBytes, 0);
                    var height = BitConverter.ToInt32(heightBytes, 0);
                    return (width, height);
                }
                else if (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase))
                {
                    stream.Seek(0, SeekOrigin.Begin);
                    if (reader.ReadByte() != 0xFF || reader.ReadByte() != 0xD8) return null;

                    while (stream.Position < stream.Length)
                    {
                        var marker = reader.ReadByte();
                        if (marker != 0xFF) continue;

                        var type = reader.ReadByte();
                        // SOF0 through SOF2
                        if (type is 0xC0 or 0xC1 or 0xC2)
                        {
                            reader.ReadBytes(3); // length (2 bytes) + precision (1 byte)
                            var heightBytes = reader.ReadBytes(2);
                            var widthBytes = reader.ReadBytes(2);
                            if (BitConverter.IsLittleEndian)
                            {
                                Array.Reverse(heightBytes);
                                Array.Reverse(widthBytes);
                            }
                            var height = (int)BitConverter.ToUInt16(heightBytes, 0);
                            var width = (int)BitConverter.ToUInt16(widthBytes, 0);
                            return (width, height);
                        }
                        else if (type is 0xD9 or 0xDA) // End of image or start of scan
                        {
                            break;
                        }
                        else
                        {
                            var lenBytes = reader.ReadBytes(2);
                            if (BitConverter.IsLittleEndian) Array.Reverse(lenBytes);
                            var length = BitConverter.ToUInt16(lenBytes, 0);
                            if (length < 2) break;
                            stream.Seek(length - 2, SeekOrigin.Current);
                        }
                    }
                }
                else if (extension.Equals(".webp", StringComparison.OrdinalIgnoreCase))
                {
                    if (stream.Length < 30) return null;
                    stream.Seek(12, SeekOrigin.Begin);
                    var formatBytes = reader.ReadBytes(4);
                    var format = System.Text.Encoding.ASCII.GetString(formatBytes);

                    if (format == "VP8 ")
                    {
                        stream.Seek(26, SeekOrigin.Begin);
                        var width = reader.ReadInt16() & 0x3FFF;
                        var height = reader.ReadInt16() & 0x3FFF;
                        return (width, height);
                    }
                    else if (format == "VP8L")
                    {
                        stream.Seek(21, SeekOrigin.Begin);
                        var b0 = reader.ReadByte();
                        var b1 = reader.ReadByte();
                        var b2 = reader.ReadByte();
                        var b3 = reader.ReadByte();
                        var width = 1 + (((b1 & 0x3F) << 8) | b0);
                        var height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
                        return (width, height);
                    }
                    else if (format == "VP8X")
                    {
                        stream.Seek(24, SeekOrigin.Begin);
                        var w0 = reader.ReadByte();
                        var w1 = reader.ReadByte();
                        var w2 = reader.ReadByte();
                        var h0 = reader.ReadByte();
                        var h1 = reader.ReadByte();
                        var h2 = reader.ReadByte();
                        var width = 1 + (w0 | (w1 << 8) | (w2 << 16));
                        var height = 1 + (h0 | (h1 << 8) | (h2 << 16));
                        return (width, height);
                    }
                }
            }
            catch
            {
                // Fallback gracefully if parsing non-standard chunks
            }

            return null;
        }
    }
}
