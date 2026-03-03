using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.ReviewDto
{
    public class CreateReviewDto
    {
        public int ExternalId { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; }
    }
}
