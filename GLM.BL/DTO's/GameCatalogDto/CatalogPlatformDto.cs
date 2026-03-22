using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.GameCatalogDto
{
    public class CatalogParentPlatformWrapper
    {
        public CatalogPlatformDto Platform { get; set; }
    }

    public class CatalogPlatformDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Slug { get; set; }
    }
}
