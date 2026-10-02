namespace LinqUp.API.Options
{
    public class ResendEmailOptions
    {
        public string ApiKey { get; set; } = string.Empty;
        public string FromAddress { get; set; } = "LinqUp <onboarding@resend.dev>";
        public string WebBaseUrl { get; set; } = "https://localhost:7220";
    }
}
