namespace LinqUp.Shared.Dtos.Profile
{
    public class AddUserSkillRequest
    {
        public Guid? SkillId { get; set; }
        public string? SkillName { get; set; }
        public int ExperienceMonths { get; set; }
    }
}
