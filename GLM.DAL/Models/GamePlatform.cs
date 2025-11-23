using Game_Library_Management_PL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class GamePlatform
    {
        public int GameId { get; set; }
        public Game Game { get; set; }

        public int PlatformId { get; set; }
        public Platform Platform { get; set; }
    }
}
