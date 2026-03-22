using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.GameCatalogDto
{
    public class CatalogGameDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Background_Image { get; set; }
        public double Rating { get; set; }
        public int? Metacritic { get; set; }
        public int Added { get; set; }
        public string Released { get; set; }
        public List<CatalogGenreDto> Genres { get; set; }
        public List<CatalogParentPlatformWrapper> Parent_Platforms { get; set; }
    }
}
