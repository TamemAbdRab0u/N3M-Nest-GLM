using Game_Library_Management_DAL.Data;
using Game_Library_Management_DAL.Models;
using Game_Library_Management.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.IdentityModel.Tokens.Jwt;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace Game_Library_Management.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext context;
        private readonly IOnlineUserTracker onlineUserTracker;
        private readonly IHubContext<NotificationHub> notificationHubContext;
        private static readonly ConcurrentDictionary<string, string> onlineChatUsers = new();
        private static readonly ConcurrentDictionary<string, CancellationTokenSource> pendingOfflineBroadcasts = new();
        private const int OfflineBroadcastDelayMs = 1800;

        private string GetUserId() =>
            Context.User?.FindFirst("uid")?.Value ?? string.Empty;

        private string GetUserName() =>
            Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? "Guest";

        public ChatHub(AppDbContext context, IOnlineUserTracker onlineUserTracker, IHubContext<NotificationHub> notificationHubContext)
        {
            this.context = context;
            this.onlineUserTracker = onlineUserTracker;
            this.notificationHubContext = notificationHubContext;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            var userName = GetUserName();
            onlineChatUsers[Context.ConnectionId] = userName;
            if (!string.IsNullOrWhiteSpace(userId))
            {
                CancelPendingOffline(userId);
                var wasOnline = onlineUserTracker.IsOnline(userId);
                onlineUserTracker.AddConnection(userId, Context.ConnectionId);
                if (!wasOnline)
                {
                    await notificationHubContext.Clients.All.SendAsync("PresenceChanged", userId, true);
                }
            }

            await Clients.Caller.SendAsync("OnlineUsers", onlineChatUsers.Values.Distinct().ToList());
            await Clients.Others.SendAsync("UserJoined", userName);

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            var userName = GetUserName();
            onlineChatUsers.TryRemove(Context.ConnectionId, out _);
            if (!string.IsNullOrWhiteSpace(userId))
            {
                onlineUserTracker.RemoveConnection(userId, Context.ConnectionId);
                ScheduleOfflineBroadcast(userId);
            }

            await Clients.All.SendAsync("UserLeft", userName);
            await base.OnDisconnectedAsync(exception);
        }

        private void CancelPendingOffline(string userId)
        {
            if (pendingOfflineBroadcasts.TryRemove(userId, out var existingCts))
            {
                existingCts.Cancel();
                existingCts.Dispose();
            }
        }

        private void ScheduleOfflineBroadcast(string userId)
        {
            CancelPendingOffline(userId);

            var cts = new CancellationTokenSource();
            pendingOfflineBroadcasts[userId] = cts;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(OfflineBroadcastDelayMs, cts.Token);

                    if (onlineUserTracker.IsOnline(userId))
                    {
                        return;
                    }

                    await notificationHubContext.Clients.All.SendAsync("PresenceChanged", userId, false);
                }
                catch (TaskCanceledException)
                {
                    // Reconnected before debounce elapsed.
                }
                finally
                {
                    if (pendingOfflineBroadcasts.TryGetValue(userId, out var current) && current == cts)
                    {
                        pendingOfflineBroadcasts.TryRemove(userId, out _);
                    }
                    cts.Dispose();
                }
            });
        }

        public async Task SendMessage(string message)
        {
            var userId   = Context.User?.FindFirst("uid")?.Value ?? "Guest";
            var userName = GetUserName();

            if (string.IsNullOrWhiteSpace(message)) return;

            var msg = new Message
            {
                SenderId   = userId,
                SenderName = userName,
                Content    = message.Trim(),
                SentAt     = DateTime.UtcNow
            };

            await context.Messages.AddAsync(msg);
            await context.SaveChangesAsync();

            await Clients.All.SendAsync("ReceiveMessage", msg.SenderName, msg.Content, msg.SentAt);
        }

        public async Task Typing()
        {
            await Clients.Others.SendAsync("UserTyping", GetUserName());
        }
    }
}
