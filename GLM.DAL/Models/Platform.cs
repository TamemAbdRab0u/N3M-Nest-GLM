using Game_Library_Management_DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_PL.Models
{
    public class Platform
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Slug { get; set; }

        public List<GamePlatform> GamePlatforms { get; set; }
    }
}
