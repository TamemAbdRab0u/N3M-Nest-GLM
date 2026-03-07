using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public enum FriendshipStatus
    {
        Pending = 0,
        Accepted = 1,
        Blocked = 2
    }

    public class Friendship
    {
        public int Id { get; set; }

        [Required]
        public string RequesterId { get; set; }
        public User Requester { get; set; }

        [Required]
        public string AddresseeId { get; set; }
        public User Addressee { get; set; }

        public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
