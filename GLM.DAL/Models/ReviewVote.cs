using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class ReviewVote
    {
        public int ReviewVoteId { get; set; }
        public bool IsLike { get; set; }
        public DateTime CreatedAt { get; set; }

        // Relations //
        public int ReviewId { get; set; }
        public Review Review { get; set; }

        public string UserId { get; set; }
        public User User { get; set; }
    }
}
