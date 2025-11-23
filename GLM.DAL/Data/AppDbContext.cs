using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Data
{
    public class AppDbContext : DbContext
    {
        // main Tables //
        public DbSet<User> Users { get; set; }
        public DbSet<Game> Games { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Platform> Platforms { get; set; }

        // Many-to-Many relationship tables //
        public DbSet<UserGame> UserGames { get; set; }
        public DbSet<GameTag> GameTags { get; set; }
        public DbSet<GamePlatform> GamePlatforms { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }
}
