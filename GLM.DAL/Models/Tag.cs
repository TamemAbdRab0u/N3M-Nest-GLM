using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class Tag
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }

        public List<GameTag> GameTags { get; set; }
    }
}
