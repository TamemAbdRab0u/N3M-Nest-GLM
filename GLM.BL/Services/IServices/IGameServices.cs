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

        Task<bool> AddTagsToGameAsync(int gameId, List<int> tagIds);
        Task<bool> ReplaceGameTagsAsync(int gameId, List<int> tagIds);
        Task<bool> RemoveTagFromGameAsync(int gameId, int tagId);
        Task<bool> RemoveTagFromGameAsync(int gameId);    

        Task<bool> AddPlatformsToGameAsync(int gameId, List<int> platformIds);
        Task<bool> RemovePlatformFromGameAsync(int gameId, int platfromId);
        Task<bool> RemovePlatformsFromGameAsync(int gameId);
    }
}
