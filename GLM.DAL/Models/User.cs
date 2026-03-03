using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class User
    {
        public string Id { get; set; }
        public string Username { get; set; }
        public string ImageUrl { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }

        public List<UserGame> UserGames { get; set; }
        public Profile Profile { get; set; }
    }
}
