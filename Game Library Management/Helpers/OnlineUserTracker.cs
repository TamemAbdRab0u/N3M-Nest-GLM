using System.Collections.Concurrent;

namespace Game_Library_Management.Helpers
{
    // Tracks active SignalR connections per user for lightweight online presence checks.
    public class OnlineUserTracker : IOnlineUserTracker
    {
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _connectionsByUser = new();

        public void AddConnection(string userId, string connectionId)
        {
            var userConnections = _connectionsByUser.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
            userConnections.TryAdd(connectionId, 0);
        }

        public void RemoveConnection(string userId, string connectionId)
        {
            if (!_connectionsByUser.TryGetValue(userId, out var userConnections))
            {
                return;
            }

            userConnections.TryRemove(connectionId, out _);

            if (userConnections.IsEmpty)
            {
                _connectionsByUser.TryRemove(userId, out _);
            }
        }

        public bool IsOnline(string userId)
        {
            return _connectionsByUser.TryGetValue(userId, out var userConnections) && !userConnections.IsEmpty;
        }
    }
}
