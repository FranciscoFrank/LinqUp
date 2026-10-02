using System.Text;
using System.Threading.RateLimiting;
using LinqUp.API.Data;
using LinqUp.API.Identity;
using LinqUp.API.Options;
using LinqUp.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LinqUp.API
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=linqup.db"));

            builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
            var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
                ?? throw new InvalidOperationException("Jwt configuration section is missing.");

            builder.Services.Configure<ResendEmailOptions>(builder.Configuration.GetSection("Resend"));

            builder.Services
                .AddIdentityCore<ApplicationUser>(options =>
                {
                    options.Password.RequiredLength = 8;
                    options.Password.RequireNonAlphanumeric = true;
                    options.User.RequireUniqueEmail = true;
                    options.Lockout.MaxFailedAccessAttempts = 5;
                    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
                })
                .AddEntityFrameworkStores<AppDbContext>()
                .AddDefaultTokenProviders();

            // Overrides Identity's default PBKDF2 hasher — last registration for the interface wins.
            builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, Argon2idPasswordHasher>();

            builder.Services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwtOptions.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwtOptions.Audience,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
                        ClockSkew = TimeSpan.FromSeconds(30)
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                            {
                                context.Token = accessToken;
                            }
                            else if (context.Request.Cookies.TryGetValue("linqup_access_token", out var token))
                            {
                                context.Token = token;
                            }
                            return Task.CompletedTask;
                        },
                        OnTokenValidated = async context =>
                        {
                            var sidClaim = context.Principal?.FindFirst("sid")?.Value;
                            if (Guid.TryParse(sidClaim, out var sid))
                            {
                                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                                var session = await db.UserSessions.FindAsync(sid);
                                if (session == null || session.RevokedAt != null || session.ExpiresAt <= DateTime.UtcNow)
                                {
                                    context.Fail("Session has been revoked or expired.");
                                    return;
                                }

                                if (DateTime.UtcNow - session.LastUsedAt > TimeSpan.FromMinutes(1))
                                {
                                    session.LastUsedAt = DateTime.UtcNow;
                                    await db.SaveChangesAsync();
                                }
                            }
                        }
                    };
                });

            builder.Services.AddAuthorization();

            const string WebClientCorsPolicy = "LinqUpWeb";
            var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? Array.Empty<string>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy(WebClientCorsPolicy, policy =>
                {
                    policy.WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                });
            });

            builder.Services.AddRateLimiter(options =>
            {
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? httpContext.Request.Headers.Host.ToString(),
                        factory: partition => new FixedWindowRateLimiterOptions
                        {
                            AutoReplenishment = true,
                            PermitLimit = 100,
                            QueueLimit = 0,
                            Window = TimeSpan.FromMinutes(1)
                        }));
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            });

            builder.Services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();
            builder.Services.AddScoped<ITokenService, TokenService>();
            builder.Services.AddScoped<IAvatarStorageService, AvatarStorageService>();
            builder.Services.AddScoped<IProfileService, ProfileService>();
            builder.Services.AddScoped<IFileStorageService, FileStorageService>();
            builder.Services.AddScoped<ITeamLogoStorageService, TeamLogoStorageService>();

            builder.Services.AddMemoryCache();
            builder.Services.AddHttpClient<IGitHubService, GitHubService>(client =>
            {
                client.BaseAddress = new Uri("https://api.github.com/");
            });
            builder.Services.AddHttpClient<IEmailService, EmailService>();
            builder.Services.AddScoped<ILiveKitMeetingService, LiveKitMeetingService>();

            builder.Services.AddSignalR();

            // Add services to the container.

            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
                });
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            var app = builder.Build();

            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Database.Migrate();
            }

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();
            app.UseRateLimiter();

            app.UseStaticFiles();

            app.UseCors(WebClientCorsPolicy);

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<LinqUp.API.Hubs.TeamChatHub>("/hubs/team-chat");

            app.Run();
        }
    }
}
