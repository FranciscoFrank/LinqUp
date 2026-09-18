namespace LinqUp.Shared.Dtos.Profile
{
    public class UpdateProfileRequest
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public bool IsOpenToWork { get; set; }
        public string? Goal { get; set; }
    }
}
