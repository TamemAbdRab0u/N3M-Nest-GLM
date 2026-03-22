using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Models
{
    public class CollectionGame
    {
        public int CollectionId { get; set; }
        public Collection Collection { get; set; }

        public int GameId { get; set; }
        public Game Game { get; set; }
    }
}
