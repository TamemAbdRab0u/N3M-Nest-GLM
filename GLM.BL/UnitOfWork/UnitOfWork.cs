using Game_Library_Management_BL.Repository.IRepository;
using Game_Library_Management_BL.Repository.Repository;
using Game_Library_Management_DAL.Data;
using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.UnitOfWork
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly AppDbContext context;
        public IRepo<User> Users { get; private set; }
        public IRepo<Game> Games { get; private set; }
        public IRepo<Tag> Tags { get; private set; }
        public IRepo<Platform> Platforms { get; private set; }
        public IRepo<Developer> Developers { get; private set; }
        public IRepo<PublisherEntity> PublisherEntities { get; private set; }
        public IRepo<UserGame> UserGames { get; private set; }
        public IRepo<GameTag> GameTags { get; private set; }
        public IRepo<GamePlatform> GamePlatforms { get; private set; }
        public IRepo<GameDeveloper> GameDevelopers { get; private set; }
        public IRepo<GamePublisher> GamePublishers { get; private set; }
        public IRepo<GameScreenshot> GameScreenshots { get; private set; }
        public IRepo<GameTrailer> GameTrailers { get; private set; }
        public IRepo<Profile> Profiles { get; private set; }
        public IRepo<Review> Reviews { get; private set; }
        public IRepo<ReviewVote> ReviewVotes { get; private set; }
        public IRepo<Friendship> Friendships { get; private set; }
        public IRepo<Collection> Collections { get; private set; }
        public IRepo<CollectionGame> CollectionGames { get; private set; }

        public UnitOfWork(AppDbContext context)
        {
            Users = new Repo<User>(context);
            Games = new Repo<Game>(context);
            Tags = new Repo<Tag>(context);
            Platforms = new Repo<Platform>(context);
            Developers = new Repo<Developer>(context);
            PublisherEntities = new Repo<PublisherEntity>(context);
            UserGames = new Repo<UserGame>(context);
            GameTags = new Repo<GameTag>(context);
            GamePlatforms = new Repo<GamePlatform>(context);
            GameDevelopers = new Repo<GameDeveloper>(context);
            GamePublishers = new Repo<GamePublisher>(context);
            GameScreenshots = new Repo<GameScreenshot>(context);
            GameTrailers = new Repo<GameTrailer>(context);
            Profiles = new Repo<Profile>(context);
            Reviews = new Repo<Review>(context);
            ReviewVotes = new Repo<ReviewVote>(context);
            Friendships = new Repo<Friendship>(context);
            Collections = new Repo<Collection>(context);
            CollectionGames = new Repo<CollectionGame>(context);
            this.context = context;
        }

        public void Save()
        {
            context.SaveChanges();
        }
    }
}

