using Game_Library_Management_DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.UserGamesDto
{
    public class UserGamesResponseDto
    {
        public string UserName { get; set; }

        public string GameTitle { get; set; }
        public string GameDescription { get; set; }
        public string GameImageUrl { get; set; }
        public DateTime ReleaseDate { get; set; }

        public Gamestatus? Gamestatus { get; set; }
        public string? Review { get; set; }
        public int? Rating { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
