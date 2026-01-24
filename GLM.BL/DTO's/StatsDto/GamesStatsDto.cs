using Game_Library_Management_DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.Stats
{
    public class GamesStatsDto
    {
        public string GameTitle { get; set; }
        public string GameDescription { get; set; }
        public string GameImageUrl { get; set; }
        public Gamestatus? Gamestatus { get; set; }
        public string? Review { get; set; }
        public int? Rating { get; set; }
    }
}
