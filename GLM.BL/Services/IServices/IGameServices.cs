using Game_Library_Management_BL.DTO_s.GamesDto_s;
using Game_Library_Management_DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IGameServices
    {
        Task<IEnumerable<GameResponseDto>> AllGamesAsync();
        Task<GameResponseDto> GameByIdAsync(int Id);
        Task<GameResponseDto> AddGameAsync(CreateGameDto game);
        Task<GameResponseDto> UpdateGameAsync(UpdateGameDto game);
        Task<bool> RemoveGameAsync(int Id);
    }
}
