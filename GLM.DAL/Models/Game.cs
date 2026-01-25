using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class Game
    {
        public int Id { get; set; }
        public int ExternalId { get; set; }
        public string Title { get; set; }
        public string? Description { get; set; }
        public string? ImgUrl { get; set; }
        public DateTime? ReleaseDate { get; set; }
        public string? Publisher { get; set; }

        public List<UserGame> UserGames { get; set; }
        public List<GameTag> GameTags { get; set; }
        public List<GamePlatform> GamePlatforms { get; set; }

    }
}
