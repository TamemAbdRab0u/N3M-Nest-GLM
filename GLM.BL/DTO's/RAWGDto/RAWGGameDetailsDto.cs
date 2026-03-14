using System;
using System.Collections.Generic;

namespace Game_Library_Management_BL.DTO_s.RAWGDto
{
    public class RAWGGameDetailsDto
    {
        public int ExternalId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string BackgroundImage { get; set; }
        public string BackgroundImageAdditional { get; set; }
        public string PosterImage { get; set; }
        public double Rating { get; set; }
        public int RatingTop { get; set; }
        public int RatingsCount { get; set; }
        public string ReleaseDate { get; set; }
        public int? Metacritic { get; set; }
        public int Playtime { get; set; }
        public string Website { get; set; }
        public string TrailerUrl { get; set; }
        public string TrailerPreview { get; set; }
        public List<string> Genres { get; set; } = new();
        public List<string> Platforms { get; set; } = new();
        public List<string> Tags { get; set; } = new();
        public List<string> Developers { get; set; } = new();
        public List<string> Publishers { get; set; } = new();
        public string EsrbRating { get; set; }
        public List<string> Screenshots { get; set; } = new();
        public string MinimumRequirements { get; set; }
        public string RecommendedRequirements { get; set; }
        public decimal? Price { get; set; }

        // User state
        public bool IsFavorite { get; set; }
        public bool IsInLibrary { get; set; }
        public bool IsInWishlist { get; set; }
    }
}
