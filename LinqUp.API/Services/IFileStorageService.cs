using LinqUp.Shared;
using Microsoft.AspNetCore.Http;

namespace LinqUp.API.Services
{
    public interface IFileStorageService
    {
        Task<(MessageAttachment? attachment, string? error)> SaveAttachmentAsync(Guid projectId, IFormFile file);
        string? GetPhysicalFilePath(Guid projectId, string storageFileName);
        void DeleteAttachmentFile(Guid projectId, string storageFileName);
    }
}
