using System;
using System.Collections.Generic;

namespace Game_Library_Management_BL.DTO_s.StoreHomeDto
{
    public class StoreHomeDto
    {
        public List<StoreSectionDto> Sections { get; set; } = new List<StoreSectionDto>();
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}
