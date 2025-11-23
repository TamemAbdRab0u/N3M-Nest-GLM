using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Helper
{
    public class Jwt
    {
        public string Key { get; set; }
        public string issuer { get; set; }
        public string Audience { get; set; }
        public string DurationInDays { get; set; }
    }
}
