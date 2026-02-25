using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.RAWGDto
{
    public class RAWGCatalogDto
    {
        public int ExternalId { get; set; }
        public string Title { get; set; }
        public string ImageUrl { get; set; }
        public double Rating { get; set; }
        public string ReleaseDate { get; set; }
        public List<string> Genres { get; set; }
        public List<string> Platforms { get; set; }
    }
}
