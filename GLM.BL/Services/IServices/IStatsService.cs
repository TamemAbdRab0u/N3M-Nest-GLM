using Game_Library_Management_BL.DTO_s.Stats;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IStatsService
    {
        Task<IEnumerable<GamesStatsDto>> CompletedGamesAsync(string userId);
        Task<IEnumerable<GamesStatsDto>> PlayingGamesAsync(string userId);
        Task<IEnumerable<GamesStatsDto>> WhishlistedGamesAsync(string userId);
        Task<IEnumerable<GamesStatsDto>> DroppedGamesAsync(string userId);

        Task<IEnumerable<GamesStatsDto>> BadGamesAsync(string userId);          // Rating < 5 
        Task<IEnumerable<GamesStatsDto>> GoodGamesAsync(string userId);         // 5 <= Rating <= 8
        Task<IEnumerable<GamesStatsDto>> PerfectGamesAsync(string userId);      // Rating > 8
    }
}
