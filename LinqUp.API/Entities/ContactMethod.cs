using LinqUp.API.Identity;
using LinqUp.Shared.Enums;

namespace LinqUp.API.Entities
{
    public class ContactMethod
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid UserId { get; set; }
        public ApplicationUser? User { get; set; }

        public ContactMethodType Type { get; set; }
        public string Value { get; set; } = string.Empty;
        public bool IsPrimary { get; set; }
    }
}
