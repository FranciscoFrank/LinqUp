namespace LinqUp.API.Services
{
    public interface ITeamLogoStorageService
    {
        Task<(string? path, string? error)> SaveAsync(Guid projectId, IFormFile file);
        void Delete(string? logoPath);
    }
}
