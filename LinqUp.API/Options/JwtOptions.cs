namespace LinqUp.API.Options
{
    // Dev-only: SigningKey lives in appsettings.Development.json. Before shipping
    // anywhere real, move it to `dotnet user-secrets` / environment config instead.
    public class JwtOptions
    {
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public string SigningKey { get; set; } = string.Empty;
        public int AccessTokenMinutes { get; set; } = 60;
        public int RefreshTokenDays { get; set; } = 30;
    }
}
