using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Game_Library_Management.Helpers;
using System.Collections.Concurrent;

namespace Game_Library_Management.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly IOnlineUserTracker onlineUserTracker;
        private static readonly ConcurrentDictionary<string, CancellationTokenSource> pendingOfflineBroadcasts = new();
        private const int OfflineBroadcastDelayMs = 1800;
        public const string PresenceGroup = "presence";

        public NotificationHub(IOnlineUserTracker onlineUserTracker)
        {
            this.onlineUserTracker = onlineUserTracker;
        }

        public override Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;
            if (!string.IsNullOrWhiteSpace(userId))
            {
                CancelPendingOffline(userId);
                var wasOnline = onlineUserTracker.IsOnline(userId);
                onlineUserTracker.AddConnection(userId, Context.ConnectionId);

                if (!wasOnline)
                {
                    _ = Clients.Group(PresenceGroup).SendAsync("PresenceChanged", userId, true);
                }
            }

            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.UserIdentifier;
            if (!string.IsNullOrWhiteSpace(userId))
            {
                onlineUserTracker.RemoveConnection(userId, Context.ConnectionId);
                ScheduleOfflineBroadcast(userId);
            }

            return base.OnDisconnectedAsync(exception);
        }

        public Task JoinPresence()
        {
            return Groups.AddToGroupAsync(Context.ConnectionId, PresenceGroup);
        }

        public Task LeavePresence()
        {
            return Groups.RemoveFromGroupAsync(Context.ConnectionId, PresenceGroup);
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

                    await Clients.Group(PresenceGroup).SendAsync("PresenceChanged", userId, false);
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
    }
}
