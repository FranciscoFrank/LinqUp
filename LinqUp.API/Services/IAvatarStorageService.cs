namespace LinqUp.API.Services
{
    public interface IAvatarStorageService
    {
        // Returns the web-relative path to store on the user (e.g. "/uploads/avatars/12.jpg"),
        // or null with an error message when the file is rejected.
        Task<(string? path, string? error)> SaveAsync(Guid userId, IFormFile file);

        void Delete(string? avatarPath);
    }
}
