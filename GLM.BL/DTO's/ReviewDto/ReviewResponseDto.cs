using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.ReviewDto
{
    public class ReviewResponseDto
    {
        public int ReviewId { get; set; }
        public int ExternalId { get; set; }
        public string UserName { get; set; }
        public string ImageUrl { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; }
        public int Likes { get; set; }
        public int Dislikes { get; set; }
        public bool? UserVote { get; set; }
        public string? GameTitle { get; set; }
        public string? GamePosterUrl { get; set; }
    }
}
