namespace LinqUp.Shared.Dtos.Profile
{
    public class SkillDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsPreset { get; set; }
    }
}
