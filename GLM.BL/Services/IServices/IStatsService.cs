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
    }
}
