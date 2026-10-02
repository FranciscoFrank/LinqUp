using System.Net.Http.Headers;
using System.Net.Http.Json;
using LinqUp.API.Options;
using Microsoft.Extensions.Options;

namespace LinqUp.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly HttpClient _http;
        private readonly ResendEmailOptions _options;
        private readonly ILogger<EmailService> _logger;

        public EmailService(HttpClient http, IOptions<ResendEmailOptions> options, ILogger<EmailService> logger)
        {
            _http = http;
            _options = options.Value;
            _logger = logger;

            if (_http.BaseAddress is null)
            {
                _http.BaseAddress = new Uri("https://api.resend.com/");
            }
        }

        public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetLink)
        {
            var subject = "Відновлення паролю — LinqUp";
            var body = $"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LinqUp</h1>
                    </div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">Відновлення доступу до облікового запису</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                        Ми отримали запит на скидання паролю для вашого акаунту в <strong>LinqUp</strong>. Натисніть кнопку нижче, щоб встановити новий безпечний пароль.
                    </p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="{resetLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 28px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">Встановити новий пароль</a>
                    </div>
                    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 20px;">
                        Якщо кнопка не спрацьовує, скопіюйте це посилання у браузер:<br />
                        <a href="{resetLink}" style="color: #6366f1; word-break: break-all;">{resetLink}</a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                        Якщо ви не надсилали запит на відновлення паролю, проігноруйте цей лист. Ваш обліковий запис залишається у повній безпеці.
                    </p>
                </div>
                """;

            return await SendEmailAsync(toEmail, subject, body);
        }

        public async Task<bool> SendEmailConfirmationAsync(string toEmail, string confirmLink)
        {
            var subject = "Підтвердження email адреси — LinqUp";
            var body = $"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LinqUp</h1>
                    </div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">Ласкаво просимо до LinqUp!</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                        Дякуємо за реєстрацію. Будь ласка, підтвердіть вашу електронну пошту, щоб активувати всі функції платформи та командної взаємодії.
                    </p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="{confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 28px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Підтвердити пошту</a>
                    </div>
                    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 20px;">
                        Або скопіюйте посилання вручну:<br />
                        <a href="{confirmLink}" style="color: #6366f1; word-break: break-all;">{confirmLink}</a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                        Якщо ви не створювали акаунт у LinqUp, просто проігноруйте цей лист.
                    </p>
                </div>
                """;

            return await SendEmailAsync(toEmail, subject, body);
        }

        public async Task<bool> SendTwoFactorEnabledEmailAsync(string toEmail, string? deviceName, string? ipAddress)
        {
            var subject = "Двоетапна автентифікація підключена — LinqUp";
            var body = $"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LinqUp</h1>
                    </div>
                    <div style="display: inline-block; padding: 6px 12px; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; border-radius: 999px; margin-bottom: 12px;">БЕЗПЕКА АКАУНТУ</div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">Двоетапну перевірку (2FA) успішно активовано</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
                        На вашому обліковому записі <strong>LinqUp</strong> було успішно налаштовано двофакторну автентифікацію через додаток-автентифікатор.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #334155;">
                        <p style="margin: 0 0 8px 0;"><strong>Пристрій:</strong> {System.Net.WebUtility.HtmlEncode(deviceName ?? "Невідомий пристрій")}</p>
                        <p style="margin: 0 0 8px 0;"><strong>IP-адреса:</strong> {System.Net.WebUtility.HtmlEncode(ipAddress ?? "Не вказано")}</p>
                        <p style="margin: 0;"><strong>Час активації:</strong> {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC</p>
                    </div>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                        Зберігайте ваші 5 резервних кодів (XXXX-XXXX-XXXX) у надійному захищеному місці на випадок втрати доступу до додатку.
                    </p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                    <p style="font-size: 12px; color: #ef4444; line-height: 1.5; margin: 0;">
                        Якщо ви НЕ виконували цю дію, негайно увійдіть в акаунт, змініть пароль та завершіть усі сесії у розділі Безпека.
                    </p>
                </div>
                """;

            return await SendEmailAsync(toEmail, subject, body);
        }

        public async Task<bool> SendNewLoginAlertEmailAsync(string toEmail, string? deviceName, string? ipAddress, DateTime loginTime)
        {
            var subject = "Новий вхід у ваш акаунт — LinqUp";
            var body = $"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LinqUp</h1>
                    </div>
                    <div style="display: inline-block; padding: 6px 12px; background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; border-radius: 999px; margin-bottom: 12px;">СПОВІЩЕННЯ ПРО ВХІД</div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">Зафіксовано новий вхід у кабінет</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
                        Ми помітили успішний вхід у ваш обліковий запис <strong>LinqUp</strong>:
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #334155;">
                        <p style="margin: 0 0 8px 0;"><strong>Пристрій:</strong> {System.Net.WebUtility.HtmlEncode(deviceName ?? "Веб-браузер")}</p>
                        <p style="margin: 0 0 8px 0;"><strong>IP-адреса:</strong> {System.Net.WebUtility.HtmlEncode(ipAddress ?? "Не визначено")}</p>
                        <p style="margin: 0;"><strong>Час:</strong> {loginTime:yyyy-MM-dd HH:mm:ss} UTC</p>
                    </div>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                        Якщо це були ви, жодних дій вживати не потрібно.
                    </p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                    <p style="font-size: 12px; color: #ef4444; line-height: 1.5; margin: 0;">
                        Якщо це були НЕ ви, перейдіть до налаштувань безпеки, відкличте сторонні сесії та негайно змініть пароль.
                    </p>
                </div>
                """;

            return await SendEmailAsync(toEmail, subject, body);
        }

        private async Task<bool> SendEmailAsync(string toEmail, string subject, string html)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                _logger.LogInformation("Email sending skipped: No Resend API key configured. Email to: {To}, Subject: {Subject}", toEmail, subject);
                return false;
            }

            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

            var payload = new
            {
                from = _options.FromAddress,
                to = new[] { toEmail },
                subject,
                html
            };

            try
            {
                var response = await _http.PostAsJsonAsync("emails", payload);
                if (!response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Resend API rejected email to {To}: Status {Status}, Response: {Body}", toEmail, response.StatusCode, responseBody);
                    return false;
                }

                _logger.LogInformation("Successfully dispatched email to {To}: {Subject}", toEmail, subject);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send email to {To} via Resend", toEmail);
                return false;
            }
        }
    }
}
