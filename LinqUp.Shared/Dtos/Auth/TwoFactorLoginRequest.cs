namespace LinqUp.Shared.Dtos.Auth
{
    public class TwoFactorLoginRequest
    {
        public string TwoFactorToken { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public bool IsRecoveryCode { get; set; }
        public string? DeviceName { get; set; }
    }
}
