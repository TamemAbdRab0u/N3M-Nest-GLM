using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.FriendshipDto
{
    public class FriendDto
    {
        public string UserId { get; set; }
        public string Username { get; set; }
        public string? DisplayName { get; set; }
        public string? AvatarUrl { get; set; }
        public string Status { get; set; }
        public bool IsSentByMe { get; set; }
        public int FriendshipId { get; set; }
    }

    public class FriendshipStatusDto
    {
        public string? Status { get; set; }
        public bool IsSentByMe { get; set; }
        public int? FriendshipId { get; set; }
        public int FriendsCount { get; set; }
    }

    public class FriendRequestNotificationDto
    {
        public int FriendshipId { get; set; }
        public string FromUserId { get; set; } = string.Empty;
        public string FromUsername { get; set; } = string.Empty;
        public string? FromDisplayName { get; set; }
        public string? FromAvatarUrl { get; set; }
        public string EventType { get; set; } = "Received";
    }
}
