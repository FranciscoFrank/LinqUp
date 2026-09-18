using LinqUp.Shared.Enums;

namespace LinqUp.Shared.Dtos.Profile
{
    public class AddContactMethodRequest
    {
        public ContactMethodType Type { get; set; }
        public string Value { get; set; } = string.Empty;
        public bool IsPrimary { get; set; }
    }
}
