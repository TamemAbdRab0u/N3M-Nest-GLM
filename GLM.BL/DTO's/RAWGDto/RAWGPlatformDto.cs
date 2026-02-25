using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.RAWGDto
{
    public class RAWGParentPlatformWrapper
    {
        public RAWGPlatformDto Platform { get; set; }
    }

    public class RAWGPlatformDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Slug { get; set; }
    }
}
