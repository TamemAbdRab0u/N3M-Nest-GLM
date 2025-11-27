using Game_Library_Management_BL.DTO_s;
using Microsoft.AspNetCore.Http;
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
        Task<GameResponseDto> CreateGameAsync(GameCreateDto game);
        Task<GameResponseDto> UpdateGameAsync(int Id, GameUpdateDto game);
        Task<GameResponseDto> PatchGameAsync(int Id, GameUpdateDto game);
        Task<bool> DeleteGameAsync(int Id);
    }
}
