namespace LinqUp.API.Services
{
    public interface IEmailService
    {
        Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetLink);
        Task<bool> SendEmailConfirmationAsync(string toEmail, string confirmLink);
        Task<bool> SendTwoFactorEnabledEmailAsync(string toEmail, string? deviceName, string? ipAddress);
        Task<bool> SendNewLoginAlertEmailAsync(string toEmail, string? deviceName, string? ipAddress, DateTime loginTime);
    }
}
