using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class UserGame
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public int GameId { get; set; }
        public Game Game { get; set; }

        public Gamestatus Gamestatus { get; set; }
        public string? Review { get; set; }
        public int? Rating { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
