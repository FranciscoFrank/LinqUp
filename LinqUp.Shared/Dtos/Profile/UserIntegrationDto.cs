namespace LinqUp.Shared.Dtos.Profile
{
    public class UserIntegrationDto
    {
        public Guid Id { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string AccountIdentifier { get; set; } = string.Empty;
        public DateTime ConnectedAt { get; set; }
    }

    public class UpdateIntegrationRequest
    {
        public string Provider { get; set; } = string.Empty;
        public string AccountIdentifier { get; set; } = string.Empty;
    }
}
