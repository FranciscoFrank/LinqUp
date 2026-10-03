namespace LinqUp.Web.Options
{
    public class ResendOptions
    {
        public string ApiKey { get; set; } = string.Empty;

        // Resend's shared sender that works without verifying a custom domain first.
        public string FromAddress { get; set; } = "LinqUp Contact <onboarding@resend.dev>";

        public string ToAddress { get; set; } = "kolia.boychak@gmail.com";
    }
}
