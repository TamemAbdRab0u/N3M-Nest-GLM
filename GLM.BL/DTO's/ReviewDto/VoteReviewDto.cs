using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.ReviewDto
{
    public class VoteReviewDto
    {
        public int ReviewId { get; set; }
        public bool? IsLike { get; set; }
    }
}
