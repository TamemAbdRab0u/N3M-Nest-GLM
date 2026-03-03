using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class Review
    {
        public int ReviewId { get; set; }
        public double Rating { get; set; }
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; }

        // Releations //
        public string UserId { get; set; }
        public User User { get; set; }

        public int ExternalId { get; set; }
    }
}
