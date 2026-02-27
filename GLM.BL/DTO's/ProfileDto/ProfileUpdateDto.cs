using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.ProfileDto
{
    public class ProfileUpdateDto
    {
        public string? DisplayName { get; set; }
        public string? Bio { get; set; }
        public string? Email { get; set; }
        public string? AvatarUrl { get; set; }
        public string? CoverUrl { get; set; }
    }
}
