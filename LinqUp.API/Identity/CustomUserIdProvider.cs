using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace LinqUp.API.Identity
{
    public class CustomUserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            // With MapInboundClaims = false, the subject claim is "sub", not ClaimTypes.NameIdentifier
            return connection.User?.FindFirst("sub")?.Value
                ?? connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
    }
}
