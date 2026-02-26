using Game_Library_Management_BL.DTO_s.UserGamesDto;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IUserGamesServices
    {
        Task<IEnumerable<UserGamesResponseDto>> AllUserGamesAsync(string UserId);
        Task<IEnumerable<UserGamesResponseDto>> GetUserGamesByStatusAsync(string UserId, Gamestatus status); 
        Task<UserGamesResponseDto> UserGameByIdAsync(string UserId, int GameId);
        Task<UserGamesResponseDto> AddUserGameAsync(string UserId, int GameId, UserGamesCreateDto createDto);
        Task<UserGamesResponseDto> UpdateUserGameAsync(string UserId, int GameId, UserGamesCreateDto updateDto);
        Task<bool> DeleteUserGameAsync(string UserId, int GameId);
    }
}
