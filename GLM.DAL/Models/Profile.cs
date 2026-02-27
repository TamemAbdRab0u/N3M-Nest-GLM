using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class Profile
    {
        public string Id { get; set; }
        public string? DisplayName { get; set; }
        public string? Bio { get; set; }
        public string? Email { get; set; }
        public string? AvatarUrl { get; set; }
        public string? CoverUrl { get; set; }

        public User user { get; set; }
        public string UserId { get; set; }
    }
}
