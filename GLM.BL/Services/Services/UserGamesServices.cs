using Azure.Identity;
using Game_Library_Management_BL.DTO_s.UserGamesDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models; // Added this namespace
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class UserGamesServices : IUserGamesServices
    {
        private readonly IUnitOfWork unitofwork;
        private readonly IRAWGService _rawgService;

        public UserGamesServices(IUnitOfWork unitofwork, IRAWGService rawgService)
        {
            this.unitofwork = unitofwork;
            _rawgService = rawgService;
        }

        public async Task<IEnumerable<UserGamesResponseDto>> AllUserGamesAsync(string UserId)
        {
            if (string.IsNullOrEmpty(UserId))
                return Enumerable.Empty<UserGamesResponseDto>();

            var UserGames = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId)
                .Include(x => x.Game)
                .Include(x => x.User)
                .ToListAsync();

            if(UserGames == null || !UserGames.Any())
                return Enumerable.Empty<UserGamesResponseDto>();

            var externalIds = UserGames.Select(ug => ug.Game.ExternalId).ToList();
            var rawgGames = await _rawgService.GetGamesByExternalIdsAsync(externalIds);

            return UserGames.Select(x => {
                var rg = rawgGames.FirstOrDefault(g => g.ExternalId == x.Game.ExternalId);
                return new UserGamesResponseDto
                {
                    UserName = x.User.Username,
                    ExternalId = x.Game.ExternalId,
                    IsFavorite = x.IsFavorite,
                    GameTitle = rg?.Title ?? x.Game.Title,
                    GameDescription = x.Game.Description,
                    GameImageUrl = rg?.ImageUrl ?? x.Game.ImgUrl,
                    ReleaseDate = x.Game.ReleaseDate ?? DateTime.MinValue,
                    Genres = rg?.Genres ?? new List<string>(),
                    Platforms = rg?.Platforms ?? new List<string>(),
                    Gamestatus = x.Gamestatus,
                    Review = x.Review,
                    Rating = rg?.Rating ?? 0,
                    UserRating = x.Rating,
                    CompletedAt = x.CompletedAt
                };
            });
        }

        public async Task<UserGamesResponseDto> UserGameByIdAsync(string UserId, int GameId)
        {
            if(string.IsNullOrEmpty(UserId))
                return null;

            if(string.IsNullOrEmpty(GameId.ToString()))
                return null;

            var UserGame = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && x.GameId == GameId)
                .Include(x => x.Game)
                .Include(x => x.User)
                .FirstOrDefaultAsync();

            if (UserGame == null)
                return null;

            var rawgGames = await _rawgService.GetGamesByExternalIdsAsync(new List<int> { UserGame.Game.ExternalId });
            var rg = rawgGames.FirstOrDefault();

            return new UserGamesResponseDto
            {
                UserName = UserGame.User.Username,
                GameTitle = rg?.Title ?? UserGame.Game.Title,
                GameDescription = UserGame.Game.Description,
                GameImageUrl = rg?.ImageUrl ?? UserGame.Game.ImgUrl,
                ReleaseDate = UserGame.Game.ReleaseDate ?? DateTime.MinValue,
                Genres = rg?.Genres ?? new List<string>(),
                Platforms = rg?.Platforms ?? new List<string>(),
                Gamestatus = UserGame.Gamestatus,
                Review = UserGame.Review,
                Rating = rg?.Rating ?? 0,
                UserRating = UserGame.Rating,
                CompletedAt = UserGame.CompletedAt
            };
        }

        public async Task<UserGamesResponseDto> AddUserGameAsync(string UserId, int GameId, UserGamesCreateDto createDto)
        {
            if (string.IsNullOrEmpty(UserId))
                return null;
            var user = await unitofwork.Users.Query().FirstOrDefaultAsync(x => x.Id == UserId);
            if (user == null)
                return null;

            if(string.IsNullOrEmpty(GameId.ToString()))
                return null;
            var game = await unitofwork.Games.GetById(GameId);
            if (game == null)
                return null;

            var existing = await unitofwork.UserGames
                .Query()
                .FirstOrDefaultAsync(x => x.UserId == UserId && x.GameId == GameId);

            if (existing != null)
            {
               throw new InvalidOperationException($"{game.Title} Already in {user.Username}'s Library.");
            }
      

            var userGame = new UserGame
            {
                UserId = UserId,
                GameId = GameId,
                Gamestatus = createDto.Gamestatus,
                Review = createDto.Review,
                Rating = createDto.Rating,
                CompletedAt = createDto.CompletedAt
            };

            await unitofwork.UserGames.Add(userGame);
            unitofwork.Save();

            var rawgGames = await _rawgService.GetGamesByExternalIdsAsync(new List<int> { game.ExternalId });
            var rg = rawgGames.FirstOrDefault();

            return new UserGamesResponseDto
            {
                UserName = user.Username,
                ExternalId = game.ExternalId,
                GameTitle = rg?.Title ?? game.Title,
                GameDescription = game.Description,
                GameImageUrl = rg?.ImageUrl ?? game.ImgUrl,
                ReleaseDate = game.ReleaseDate ?? DateTime.MinValue,
                Genres = rg?.Genres ?? new List<string>(),
                Platforms = rg?.Platforms ?? new List<string>(),
                Gamestatus = createDto.Gamestatus,
                Review = createDto.Review,
                UserRating = createDto.Rating,
                Rating = rg?.Rating ?? 0,
                CompletedAt = createDto.CompletedAt
            };
        }

        public async Task<UserGamesResponseDto> UpdateUserGameAsync(string UserId, int GameId, UserGamesCreateDto updateDto)
        {
            var ExistedUserGame = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && x.GameId == GameId)
                .Include(x => x.Game)
                .Include(x => x.User)
                .FirstOrDefaultAsync();

            if (ExistedUserGame == null)
                return null;

            UpdateUserGameProperties(ExistedUserGame, updateDto);

            await unitofwork.UserGames.Update(ExistedUserGame);
            unitofwork.Save();

            var rawgGames = await _rawgService.GetGamesByExternalIdsAsync(new List<int> { ExistedUserGame.Game.ExternalId });
            var rg = rawgGames.FirstOrDefault();

            return new UserGamesResponseDto
            {
                UserName = ExistedUserGame.User.Username,
                ExternalId = ExistedUserGame.Game.ExternalId,
                IsFavorite = ExistedUserGame.IsFavorite,
                GameTitle = rg?.Title ?? ExistedUserGame.Game.Title,
                GameDescription = ExistedUserGame.Game.Description,
                GameImageUrl = rg?.ImageUrl ?? ExistedUserGame.Game.ImgUrl,
                ReleaseDate = ExistedUserGame.Game.ReleaseDate ?? DateTime.MinValue,
                Genres = rg?.Genres ?? new List<string>(),
                Platforms = rg?.Platforms ?? new List<string>(),
                Gamestatus = ExistedUserGame.Gamestatus,
                Review = ExistedUserGame.Review,
                UserRating = ExistedUserGame.Rating,
                Rating = rg?.Rating ?? 0,
                CompletedAt = ExistedUserGame.CompletedAt
            };
        }

        private void UpdateUserGameProperties(UserGame existingUserGame, UserGamesCreateDto updateDto)
        {
            if(!string.IsNullOrWhiteSpace(updateDto.Gamestatus.ToString()))
                existingUserGame.Gamestatus = updateDto.Gamestatus;

            if (!string.IsNullOrWhiteSpace(updateDto.Review))
                existingUserGame.Review = updateDto.Review;

            if(updateDto.Rating.HasValue)
                existingUserGame.Rating = updateDto.Rating;

            if(updateDto.CompletedAt.HasValue)
                existingUserGame.CompletedAt = updateDto.CompletedAt;

        }

        public async Task<bool> DeleteUserGameAsync(string UserId, int GameId)
        {
            if (string.IsNullOrWhiteSpace(UserId))
                return false;

            if(string.IsNullOrWhiteSpace(GameId.ToString()))
                return false;

            var ExistedUserGame = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && x.GameId == GameId)
                .FirstOrDefaultAsync();

            var IsDeleted = await unitofwork.UserGames.DeleteAsync(ExistedUserGame);
            unitofwork.Save();

            if(IsDeleted)
                return true;
            else
                return false;
        }
    }
}
