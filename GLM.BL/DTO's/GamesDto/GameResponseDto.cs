using Game_Library_Management_BL.DTO_s.TagsDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s
{
    public class GameResponseDto
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string? Description { get; set; }
        public string? ImgUrl { get; set; }
        public DateTime? ReleaseDate { get; set; }
        public string? Publisher { get; set; }
        public List<TagDto>? Tags { get; set; }
    }

    public class TagDto
    {
        public string Name { get; set; }
    }
}
