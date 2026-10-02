using LinqUp.API.Identity;

namespace LinqUp.API.Entities
{
    public class UserSkill
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid UserId { get; set; }
        public ApplicationUser? User { get; set; }

        public Guid SkillId { get; set; }
        public Skill? Skill { get; set; }

        public int ExperienceMonths { get; set; }
    }
}
