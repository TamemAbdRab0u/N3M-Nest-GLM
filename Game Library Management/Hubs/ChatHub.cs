using Game_Library_Management_DAL.Data;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.SignalR;

namespace Game_Library_Management.Hubs
{
    public class ChatHub : Hub
    {
        private readonly AppDbContext context;
        public ChatHub(AppDbContext context)
        {
            this.context = context;
        }

        public async Task SendMessage(string message)
        { 
            var userId = Context.User?.FindFirst("uid")?.Value ?? "Guest";
            var UserName = Context.User?.Identity?.Name ?? "Guest";

            var msg = new Message
            {
                SenderId = userId,
                SenderName = UserName,
                Content = message,
                SentAt = DateTime.UtcNow
            };

            await context.Messages.AddAsync(msg);
            await context.SaveChangesAsync();

            await Clients.All.SendAsync("ReceiveMessage",msg.SenderName,msg.Content,msg.SentAt);
        }
    }
}
