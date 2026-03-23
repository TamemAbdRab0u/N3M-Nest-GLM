using Game_Library_Management_BL.DTO_s.GamesDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.CollectionsDto
{
    public class CollectionResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<GameResponseDto> Games { get; set; } = new List<GameResponseDto>();
    }

    public class CollectionCreateDto
    {
        public string Name { get; set; }
    }
}
