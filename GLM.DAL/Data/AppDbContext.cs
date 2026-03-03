using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_DAL.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser>
    {
        // main Tables //
        public DbSet<User> Users { get; set; }
        public DbSet<Game> Games { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Platform> Platforms { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<Profile> profiles { get; set; }

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

            modelBuilder.Entity<UserGame>().HasKey(x => new { x.GameId, x.UserId });
            modelBuilder.Entity<UserGame>().HasOne(x => x.Game).WithMany(x => x.UserGames).HasForeignKey(x => x.GameId);
            modelBuilder.Entity<UserGame>().HasOne(x => x.User).WithMany(x => x.UserGames).HasForeignKey(x => x.UserId);

            modelBuilder.Entity<GameTag>().HasKey(x => new {x.GameId, x.TagId });
            modelBuilder.Entity<GameTag>().HasOne(x => x.Game).WithMany(x => x.GameTags).HasForeignKey(x => x.GameId);
            modelBuilder.Entity<GameTag>().HasOne(x => x.Tag).WithMany(x => x.GameTags).HasForeignKey(x => x.TagId);

            modelBuilder.Entity<GamePlatform>().HasKey(x => new{x.GameId, x.PlatformId });
            modelBuilder.Entity<GamePlatform>().HasOne(x => x.Game).WithMany(x => x.GamePlatforms).HasForeignKey(x => x.GameId);
            modelBuilder.Entity<GamePlatform>().HasOne(x => x.Platform).WithMany(x => x.GamePlatforms).HasForeignKey(x => x.PlatformId);

            modelBuilder.Entity<User>().HasOne(x => x.Profile).WithOne(x => x.user).HasForeignKey<Profile>(x => x.UserId);

            modelBuilder.Entity<UserGame>().Property(x => x.AddedAt).HasDefaultValueSql("GETUTCDATE()");

            modelBuilder.Entity<Review>().HasIndex(x => new { x.ExternalId, x.UserId }).IsUnique();

            modelBuilder.Entity<ReviewVote>().HasIndex(x => new { x.ReviewId, x.UserId }).IsUnique();
            modelBuilder.Entity<ReviewVote>().HasOne(x => x.Review).WithMany(x => x.Votes).HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ReviewVote>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<IdentityRole>().HasData(
               new IdentityRole
               {
                   Id = "24620023-ec75-4764-8841-f67f62d8544d",
                   Name = "Admin",
                   NormalizedName = "ADMIN"
               },
               new IdentityRole
               {
                   Id = "8fada92e-503c-4dee-8a7e-1316f73db59f",
                   Name = "User",

                   NormalizedName = "USER"
               }
            );
        }
    }
}
