namespace Game_Library_Management.Helpers
{
    public interface IOnlineUserTracker
    {
        void AddConnection(string userId, string connectionId);
        void RemoveConnection(string userId, string connectionId);
        bool IsOnline(string userId);
    }
}
