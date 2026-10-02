namespace LinqUp.API.Entities
{
    public class Skill
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();
        public string Name { get; set; } = string.Empty;
        public bool IsPreset { get; set; }

        public List<UserSkill> UserSkills { get; set; } = new();
    }
}
