using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.GameCatalogDto
{
    public class CatalogGameSummaryDto
    {
        public int ExternalId { get; set; }
        public string Title { get; set; }
        public string ImageUrl { get; set; }
        public double Rating { get; set; }
        public int? Metacritic { get; set; }
        public string ReleaseDate { get; set; }
        public List<string> Genres { get; set; }
        public List<string> Platforms { get; set; }
        public bool IsFavorite { get; set; }
        public bool IsInLibrary { get; set; }
        public bool IsInWishlist { get; set; }
        public string? Gamestatus { get; set; }
    }
}
