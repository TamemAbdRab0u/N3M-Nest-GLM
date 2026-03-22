using Azure.Identity;
using Game_Library_Management_BL.DTO_s.GameCatalogDto;
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
        private readonly ISteamService _steamService;

        public UserGamesServices(IUnitOfWork unitofwork, ISteamService steamService)
        {
            this.unitofwork = unitofwork;
            _steamService = steamService;
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
            var catalogGames = await _steamService.GetGamesByExternalIdsAsync(externalIds);

            return UserGames.Select(x => MapToResponseDto(x, catalogGames.FirstOrDefault(g => g.ExternalId == x.Game.ExternalId)));
        }

        private static UserGamesResponseDto MapToResponseDto(UserGame x, CatalogGameSummaryDto? cg)
        {
            return new UserGamesResponseDto
            {
                UserName = x.User?.Username,
                ExternalId = x.Game.ExternalId,
                IsFavorite = x.IsFavorite,
                IsInWishlist = x.IsInWishlist,
                GameTitle = cg?.Title ?? x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = cg?.ImageUrl ?? x.Game.ImgUrl,
                PosterImageUrl = x.Game.PosterImageUrl ?? (x.Game.ImgUrl != null && x.Game.ImgUrl.Contains("steamstatic") ? $"https://cdn.akamai.steamstatic.com/steam/apps/{x.Game.ExternalId}/library_600x900_2x.jpg" : null),
                ReleaseDate = x.Game.ReleaseDate ?? DateTime.MinValue,
                Genres = cg?.Genres ?? new List<string>(),
                Platforms = cg?.Platforms ?? new List<string>(),
                Gamestatus = x.Gamestatus,
                Review = x.Review,
                Rating = cg?.Rating ?? 0,
                UserRating = x.Rating,
                CompletedAt = x.CompletedAt,
                AddedAt = x.AddedAt
            };
        }

        public async Task<IEnumerable<UserGamesResponseDto>> GetPublicUserGamesAsync(string username)
        {
            if (string.IsNullOrEmpty(username))
                return Enumerable.Empty<UserGamesResponseDto>();

            var user = await unitofwork.Users.Query().FirstOrDefaultAsync(x => x.Username == username);
            if (user == null)
                return Enumerable.Empty<UserGamesResponseDto>();

            return await AllUserGamesAsync(user.Id);
        }

        public async Task<IEnumerable<UserGamesResponseDto>> GetUserGamesByStatusAsync(string UserId, Gamestatus status)
        {
            if (string.IsNullOrEmpty(UserId))
                return Enumerable.Empty<UserGamesResponseDto>();

            var UserGames = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && x.Gamestatus == status)
                .Include(x => x.Game)
                .Include(x => x.User)
                .ToListAsync();

            if (UserGames == null || !UserGames.Any())
                return Enumerable.Empty<UserGamesResponseDto>();

            var externalIds = UserGames.Select(ug => ug.Game.ExternalId).ToList();
            var catalogGames = await _steamService.GetGamesByExternalIdsAsync(externalIds);

            return UserGames.Select(x => MapToResponseDto(x, catalogGames.FirstOrDefault(g => g.ExternalId == x.Game.ExternalId)));
        }

        public async Task<UserGamesResponseDto> UserGameByIdAsync(string UserId, int GameId)
        {
            if(string.IsNullOrEmpty(UserId))
                return null;

            if(string.IsNullOrEmpty(GameId.ToString()))
                return null;

            var UserGame = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && (x.GameId == GameId || x.Game.ExternalId == GameId))
                .Include(x => x.Game)
                .Include(x => x.User)
                .FirstOrDefaultAsync();

            if (UserGame == null)
                return null;

            var catalogGames = await _steamService.GetGamesByExternalIdsAsync(new List<int> { UserGame.Game.ExternalId });
            var cg = catalogGames.FirstOrDefault();

            return MapToResponseDto(UserGame, cg);
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

            var catalogGames = await _steamService.GetGamesByExternalIdsAsync(new List<int> { game.ExternalId });
            var cg = catalogGames.FirstOrDefault();

            userGame.User = user;
            userGame.Game = game;

            return MapToResponseDto(userGame, cg);
        }

        public async Task<UserGamesResponseDto> UpdateUserGameAsync(string UserId, int GameId, UserGamesCreateDto updateDto)
        {
            var ExistedUserGame = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId && (x.GameId == GameId || x.Game.ExternalId == GameId))
                .Include(x => x.Game)
                .Include(x => x.User)
                .FirstOrDefaultAsync();

            if (ExistedUserGame == null)
                return null;

            UpdateUserGameProperties(ExistedUserGame, updateDto);

            await unitofwork.UserGames.Update(ExistedUserGame);
            unitofwork.Save();

            var catalogGames = await _steamService.GetGamesByExternalIdsAsync(new List<int> { ExistedUserGame.Game.ExternalId });
            var cg = catalogGames.FirstOrDefault();

            return MapToResponseDto(ExistedUserGame, cg);
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
                .Where(x => x.UserId == UserId && (x.GameId == GameId || x.Game.ExternalId == GameId))
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
