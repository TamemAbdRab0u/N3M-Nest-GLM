using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Game_Library_Management.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        // Connection management is handled automatically by SignalR.
        // Routing to a specific user is done via IUserIdProvider (NotificationUserIdProvider).
        // Send to a specific user: hubContext.Clients.User(userId).SendAsync(...)
    }
}
