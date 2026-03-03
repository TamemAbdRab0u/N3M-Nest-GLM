using Game_Library_Management_BL.Repository.IRepository;
using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.UnitOfWork
{
    public interface IUnitOfWork
    {
        public IRepo<User> Users { get; }
        public IRepo<Game> Games { get; }
        public IRepo<Tag> Tags { get; }
        public IRepo<Platform> Platforms { get; }
        public IRepo<UserGame> UserGames { get; }
        public IRepo<GameTag> GameTags { get; }
        public IRepo<GamePlatform> GamePlatforms { get; }
        public IRepo<Profile> Profiles { get; }
        public IRepo<Review> Reviews { get; }

        public void Save();
    }
}
