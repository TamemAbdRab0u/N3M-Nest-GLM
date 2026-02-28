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
        public int ExternalId { get; set; } // Added External ID
        public bool IsFavorite { get; set; } // Added IsFavorite

        public string GameTitle { get; set; }
        public string GameDescription { get; set; }
        public string GameImageUrl { get; set; }
        public DateTime ReleaseDate { get; set; }

        public List<string> Genres { get; set; } = new List<string>();
        public List<string> Platforms { get; set; } = new List<string>();

        public Gamestatus? Gamestatus { get; set; }
        public string? Review { get; set; }
        public double? Rating { get; set; }
        public int? UserRating { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime AddedAt { get; set; }
    }
}
