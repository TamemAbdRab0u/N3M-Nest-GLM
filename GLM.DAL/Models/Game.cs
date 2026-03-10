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
        public string? BackgroundImageUrl { get; set; }
        public int? Metacritic { get; set; }
        public double? Rating { get; set; }
        public int? RatingTop { get; set; }
        public int? RatingsCount { get; set; }
        public int? Playtime { get; set; }
        public DateTime? ReleaseDate { get; set; }
        public string? Publisher { get; set; }
        public string? Website { get; set; }
        public string? EsrbRating { get; set; }
        public string? MinimumRequirements { get; set; }
        public string? RecommendedRequirements { get; set; }
        public bool IsDetailsHydrated { get; set; }
        public DateTime? DetailsLastSyncedAt { get; set; }

        public List<UserGame> UserGames { get; set; }
        public List<GameTag> GameTags { get; set; }
        public List<GamePlatform> GamePlatforms { get; set; }
        public List<GameScreenshot> Screenshots { get; set; }
        public List<GameTrailer> Trailers { get; set; }
        public List<GameDeveloper> GameDevelopers { get; set; }
        public List<GamePublisher> GamePublishers { get; set; }

    }
}
