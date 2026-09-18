namespace LinqUp.Shared.Dtos.Auth
{
    public class ChangeEmailRequest
    {
        public string NewEmail { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
