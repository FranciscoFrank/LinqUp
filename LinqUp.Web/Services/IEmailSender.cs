namespace LinqUp.Web.Services
{
    public interface IEmailSender
    {
        Task<bool> SendContactMessageAsync(string name, string fromEmail, string subject, string message);
    }
}
