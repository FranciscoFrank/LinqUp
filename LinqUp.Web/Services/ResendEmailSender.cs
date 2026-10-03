using System.Net.Http.Headers;
using System.Net.Http.Json;
using LinqUp.Web.Options;
using Microsoft.Extensions.Options;

namespace LinqUp.Web.Services
{
    public class ResendEmailSender : IEmailSender
    {
        private readonly HttpClient _http;
        private readonly ResendOptions _options;
        private readonly ILogger<ResendEmailSender> _logger;

        public ResendEmailSender(HttpClient http, IOptions<ResendOptions> options, ILogger<ResendEmailSender> logger)
        {
            _http = http;
            _http.BaseAddress = new Uri("https://api.resend.com/");
            _options = options.Value;
            _logger = logger;
        }

        public async Task<bool> SendContactMessageAsync(string name, string fromEmail, string subject, string message)
        {
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

            var html = $"""
                <p><strong>Від:</strong> {System.Net.WebUtility.HtmlEncode(name)} ({System.Net.WebUtility.HtmlEncode(fromEmail)})</p>
                <p><strong>Тема:</strong> {System.Net.WebUtility.HtmlEncode(subject)}</p>
                <p>{System.Net.WebUtility.HtmlEncode(message).Replace("\n", "<br />")}</p>
                """;

            var payload = new
            {
                from = _options.FromAddress,
                to = new[] { _options.ToAddress },
                reply_to = fromEmail,
                subject = $"[LinqUp] {subject}",
                html
            };

            try
            {
                var response = await _http.PostAsJsonAsync("emails", payload);
                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Resend send failed: {Status} {Body}", response.StatusCode, body);
                }

                return response.IsSuccessStatusCode;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Resend request failed");
                return false;
            }
        }
    }
}
