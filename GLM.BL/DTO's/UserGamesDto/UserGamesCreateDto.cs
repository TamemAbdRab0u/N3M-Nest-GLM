using Game_Library_Management_DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.UserGamesDto
{
    public class UserGamesCreateDto
    {
        public int GameId { get; set; }
        public Gamestatus Gamestatus { get; set; }
        public string? Review { get; set; }
        public int? Rating { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
