using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.DTO_s.Authentication
{
    public class AuthResponseDto
    {
        public string UserName { get; set; }
        public string Email { get; set; }
        public string Message { get; set; }
        public bool IsAuthenticated { get; set; }
        public List<string> UserRoles { get; set; }
        public string Token { get; set; }
        public DateTime ExpiresOn { get; set; }
    }
}
