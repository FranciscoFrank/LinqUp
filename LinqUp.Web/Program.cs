using LinqUp.Web.Options;
using LinqUp.Web.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.Configure<RouteOptions>(options =>
{
    options.LowercaseUrls = true;
});

builder.Services.Configure<ResendOptions>(builder.Configuration.GetSection("Resend"));
builder.Services.AddHttpClient<IEmailSender, ResendEmailSender>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

const string CultureCookieName = "linqup_culture";
var supportedCultures = new[] { "en", "uk" };

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? "/";
    var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
    var firstSegment = segments.Length > 0 ? segments[0] : null;

    if (firstSegment is not null && supportedCultures.Contains(firstSegment))
    {
        context.Response.Cookies.Append(CultureCookieName, firstSegment, new CookieOptions
        {
            Expires = DateTimeOffset.UtcNow.AddYears(1),
            IsEssential = true
        });
        await next();
        return;
    }

    // Static assets and the same-origin contact-form endpoint aren't culture-prefixed pages.
    if (path.Contains('.') || path.StartsWith("/Contact", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var culture = context.Request.Cookies[CultureCookieName];
    if (culture is null || !supportedCultures.Contains(culture))
    {
        var preferred = context.Request.Headers.AcceptLanguage.ToString()
            .Split(',').FirstOrDefault()?.Split(';').FirstOrDefault()?.Trim();
        culture = preferred is not null && preferred.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "uk";
    }

    context.Response.Redirect($"/{culture}{path}{context.Request.QueryString}");
});

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "contact",
    pattern: "Contact/{action}",
    defaults: new { controller = "Contact" });

app.MapControllerRoute(
    name: "publicProfile",
    pattern: "{culture:regex(^(en|uk)$)}/u/{nickname}",
    defaults: new { controller = "Profile", action = "Public" });

app.MapControllerRoute(
    name: "projectDetails",
    pattern: "{culture:regex(^(en|uk)$)}/Projects/{id:guid}",
    defaults: new { controller = "Projects", action = "Details" });

app.MapControllerRoute(
    name: "faq",
    pattern: "{culture:regex(^(en|uk)$)}/Faq",
    defaults: new { controller = "Home", action = "Faq" });

app.MapControllerRoute(
    name: "default",
    pattern: "{culture:regex(^(en|uk)$)}/{controller=Home}/{action=Index}/{id?}");

app.Run();
