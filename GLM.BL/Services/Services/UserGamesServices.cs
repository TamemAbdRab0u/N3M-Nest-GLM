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
        public UserGamesServices(IUnitOfWork unitofwork)
        {
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<UserGamesResponseDto>> AllUserGamesAsync(string UserId)
        {
            if (string.IsNullOrEmpty(UserId))
                return Enumerable.Empty<UserGamesResponseDto>();

            var UserGames = await unitofwork.UserGames
                .Query()
                .Where(x => x.UserId == UserId)
                .Include(x => x.Game)
                    .ThenInclude(g => g.GameTags).ThenInclude(gt => gt.Tag)
                .Include(x => x.Game)
                    .ThenInclude(g => g.GamePlatforms).ThenInclude(gp => gp.Platform)
                .Include(x => x.User)
                .ToListAsync();

            if(UserGames == null || !UserGames.Any())
                return Enumerable.Empty<UserGamesResponseDto>();

            return UserGames.Select(x => new UserGamesResponseDto
            {
                UserName = x.User.Username,
                ExternalId = x.Game.ExternalId,
                IsFavorite = x.IsFavorite,
                GameTitle = x.Game.Title,
                GameDescription = x.Game.Description,
                GameImageUrl = x.Game.ImgUrl,
                ReleaseDate = x.Game.ReleaseDate ?? DateTime.MinValue,
                Genres = x.Game.GameTags.Select(gt => gt.Tag.Name).ToList(),
                Platforms = x.Game.GamePlatforms.Select(gp => gp.Platform.Name).ToList(),
                Gamestatus = x.Gamestatus,
                Review = x.Review,
                Rating = x.Rating,
                CompletedAt = x.CompletedAt
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

            return new UserGamesResponseDto
            {
                UserName = UserGame.User.Username,
                GameTitle = UserGame.Game.Title,
                GameDescription = UserGame.Game.Description,
                GameImageUrl = UserGame.Game.ImgUrl,
                ReleaseDate = UserGame.Game.ReleaseDate ?? DateTime.MinValue,
                Gamestatus = UserGame.Gamestatus,
                Review = UserGame.Review,
                Rating = UserGame.Rating,
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

            return new UserGamesResponseDto
            {
                UserName = user.Username,
                GameTitle = game.Title,
                GameDescription = game.Description,
                GameImageUrl = game.ImgUrl,
                ReleaseDate = game.ReleaseDate ?? DateTime.MinValue,
                Gamestatus = createDto.Gamestatus,
                Review = createDto.Review,
                Rating = createDto.Rating,
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

            return new UserGamesResponseDto
            {
                UserName = ExistedUserGame.User.Username,
                GameTitle = ExistedUserGame.Game.Title,
                GameDescription = ExistedUserGame.Game.Description,
                GameImageUrl = ExistedUserGame.Game.ImgUrl,
                ReleaseDate = ExistedUserGame.Game.ReleaseDate ?? DateTime.MinValue,
                Gamestatus = ExistedUserGame.Gamestatus,
                Review = ExistedUserGame.Review,
                Rating = ExistedUserGame.Rating,
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
