using System;
using System.Collections.Generic;
using Game_Library_Management_BL.DTO_s.GameCatalogDto;

namespace Game_Library_Management_BL.DTO_s.StoreHomeDto
{
    public class StoreSectionDto
    {
        public string Title { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty; // e.g., "top_sellers", "new_releases"
        public List<CatalogGameSummaryDto> Games { get; set; } = new List<CatalogGameSummaryDto>();
    }
}
