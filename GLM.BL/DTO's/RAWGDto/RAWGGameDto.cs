using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.RAWGDto
{
    public class RAWGGameDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Background_Image { get; set; }
        public double Rating { get; set; }
        public string Released { get; set; }
    }
}
