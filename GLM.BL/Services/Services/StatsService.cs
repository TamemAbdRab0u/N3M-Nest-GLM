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
            }).ToList();

            return DroppedGames;
        }       
    }
}
