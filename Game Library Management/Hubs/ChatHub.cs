using Game_Library_Management_DAL.Data;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace Game_Library_Management.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext context;

        private static readonly ConcurrentDictionary<string, string> _onlineUsers = new();

        private string GetUserName() =>
            Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Guest";

        public ChatHub(AppDbContext context)
        {
            this.context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userName = GetUserName();
            _onlineUsers[Context.ConnectionId] = userName;

            await Clients.Caller.SendAsync("OnlineUsers", _onlineUsers.Values.Distinct().ToList());
            await Clients.Others.SendAsync("UserJoined", userName);

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_onlineUsers.TryRemove(Context.ConnectionId, out var userName))
            {
                await Clients.All.SendAsync("UserLeft", userName);
            }
            await base.OnDisconnectedAsync(exception);
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
