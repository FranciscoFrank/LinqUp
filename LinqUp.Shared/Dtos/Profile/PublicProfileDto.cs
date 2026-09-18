namespace LinqUp.Shared.Dtos.Profile
{
    public class PublicProfileDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        
        public bool IsOpenToWork { get; set; }
        public string? Goal { get; set; }

        public List<ContactMethodDto> ContactMethods { get; set; } = new();
        public List<UserSkillDto> Skills { get; set; } = new();
    }
}
