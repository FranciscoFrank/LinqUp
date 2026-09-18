namespace LinqUp.Shared.Dtos.Profile
{
    public class UserSkillDto
    {
        public Guid Id { get; set; }
        public Guid SkillId { get; set; }
        public string SkillName { get; set; } = string.Empty;
        public int ExperienceMonths { get; set; }
    }
}
