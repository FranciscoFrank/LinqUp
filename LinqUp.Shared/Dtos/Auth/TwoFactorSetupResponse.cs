namespace LinqUp.Shared.Dtos.Auth
{
    public class TwoFactorSetupResponse
    {
        public string ManualEntryKey { get; set; } = string.Empty;
        public string OtpAuthUri { get; set; } = string.Empty;
    }
}
