using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.GamesDto_s
{
    public class UpdateGameDto
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string? Description { get; set; }
        public string? ImgUrl { get; set; }
        public DateTime? ReleaseDate { get; set; }
        public string? Publisher { get; set; }
    }
}
