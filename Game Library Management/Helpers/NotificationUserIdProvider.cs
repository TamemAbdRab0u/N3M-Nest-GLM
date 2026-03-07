using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Game_Library_Management.Helpers
{
    /// <summary>
    /// Routes SignalR connections by the "uid" JWT claim (ASP.NET Identity user ID),
    /// matching the same identifier used throughout the API controllers.
    /// </summary>
    public class NotificationUserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            return connection.User?.FindFirst("uid")?.Value;
        }
    }
}
