using Game_Library_Management_BL.DTO_s.Stats;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class StatsService : IStatsService
    {
        private readonly IUnitOfWork unitofwork;
        public StatsService(IUnitOfWork unitofwork)
        { 
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<GamesStatsDto>> CompletedGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Gamestatus == Gamestatus.completed).ToListAsync();
            if(!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var completedGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Review = x.Review,
                Rating = x.Rating,
                Gamestatus = x.Gamestatus,
                Count = games.Count()
            }).ToList();

            return completedGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> PlayingGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Gamestatus == Gamestatus.playing).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var PlayingGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Review = x.Review,
                Rating = x.Rating,
                Gamestatus = x.Gamestatus,
                Count = games.Count()
            }).ToList();

            return PlayingGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> WhishlistedGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Gamestatus == Gamestatus.whishlist).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var WhishlistedGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Review = x.Review,
                Rating = x.Rating,
                Gamestatus = x.Gamestatus,
                Count = games.Count()
            }).ToList();

            return WhishlistedGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> DroppedGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Gamestatus == Gamestatus.Dropped).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var DroppedGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Review = x.Review,
                Rating = x.Rating,
                Gamestatus = x.Gamestatus,
                Count = games.Count()
            }).ToList();

            return DroppedGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> BadGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Rating < 5).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var BadGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Gamestatus = x.Gamestatus,
                Review = x.Review,
                Rating = x.Rating,
                Count = games.Count()
            }).ToList();

            return BadGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> GoodGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Rating >= 5 && x.Rating <= 8).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var GoodGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Gamestatus = x.Gamestatus,
                Review = x.Review,
                Rating = x.Rating,
                Count = games.Count()
            }).ToList();

            return GoodGames;
        }

        public async Task<IEnumerable<GamesStatsDto>> PerfectGamesAsync(string userId)
        {
            var games = await unitofwork.UserGames.Query().Where(x => x.UserId == userId).Include(x => x.Game).Where(x => x.Rating > 8).ToListAsync();
            if (!games.Any())
            {
                return Enumerable.Empty<GamesStatsDto>();
            }

            var PerfectGames = games.Select(x => new GamesStatsDto
            {
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                Gamestatus = x.Gamestatus,
                Review = x.Review,
                Rating = x.Rating,
                Count = games.Count()
            }).ToList();

            return PerfectGames;
        }
    }
}
