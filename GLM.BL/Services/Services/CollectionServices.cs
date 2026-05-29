using Game_Library_Management_BL.DTO_s.CollectionsDto;
using Game_Library_Management_BL.DTO_s.GamesDto;
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
    public class CollectionServices : ICollectionServices
    {
        private readonly IUnitOfWork unitofwork;
        private readonly ISteamService _steamService;

        public CollectionServices(IUnitOfWork unitofwork, ISteamService steamService)
        {
            this.unitofwork = unitofwork;
            _steamService = steamService;
        }

        public async Task<IEnumerable<CollectionResponseDto>> GetCollectionsByUsernameAsync(string username)
        {
            var user = await unitofwork.Users.Query()
                .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());

            if (user == null) return new List<CollectionResponseDto>();

            return await GetUserCollectionsAsync(user.Id);
        }

        public async Task<IEnumerable<CollectionResponseDto>> GetUserCollectionsAsync(string userId)
        {
            var collections = await unitofwork.Collections.Query()
                .Where(c => c.UserId == userId)
                .Include(c => c.CollectionGames)
                .ThenInclude(cg => cg.Game)
                .ToListAsync();

            var response = new List<CollectionResponseDto>();
            foreach (var c in collections)
            {
                var dto = new CollectionResponseDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = (c.UpdatedAt == DateTime.MinValue) ? c.CreatedAt : c.UpdatedAt,
                    Games = new List<GameResponseDto>()
                };

                if (c.CollectionGames.Any())
                {
                    var externalIds = c.CollectionGames.Select(cg => cg.Game.ExternalId).ToList();
                    var catalogGames = await _steamService.GetGamesByExternalIdsAsync(externalIds);

                    foreach (var cg in c.CollectionGames)
                    {
                        var cgSummary = catalogGames.FirstOrDefault(g => g.ExternalId == cg.Game.ExternalId);
                        dto.Games.Add(new GameResponseDto
                        {
                            Id = cg.Game.Id,
                            ExternalId = cg.Game.ExternalId,
                            Title = cgSummary?.Title ?? cg.Game.Title,
                            ImgUrl = cgSummary?.ImageUrl ?? cg.Game.ImgUrl,
                            Metacritic = cgSummary?.Metacritic ?? cg.Game.Metacritic,
                            Rating = (cgSummary != null) ? cgSummary.Rating : cg.Game.Rating,
                            ReleaseDate = (cgSummary != null && DateTime.TryParse(cgSummary.ReleaseDate, out var date)) ? date : cg.Game.ReleaseDate,
                            Genres = cgSummary?.Genres ?? new List<string>(),
                            Platforms = cgSummary?.Platforms ?? new List<string>()
                        });
                    }
                }
                response.Add(dto);
            }

            return response;
        }

        public async Task<CollectionResponseDto> CreateCollectionAsync(string userId, CollectionCreateDto dto)
        {
            var collection = new Collection
            {
                Name = dto.Name,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await unitofwork.Collections.Add(collection);
            unitofwork.Save();

            return new CollectionResponseDto
            {
                Id = collection.Id,
                Name = collection.Name,
                CreatedAt = collection.CreatedAt,
                UpdatedAt = collection.UpdatedAt,
                Games = new List<GameResponseDto>()
            };
        }

        public async Task<bool> DeleteCollectionAsync(int id, string userId)
        {
            var collection = await unitofwork.Collections.Query()
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

            if (collection == null) return false;

            await unitofwork.Collections.DeleteAsync(collection);
            unitofwork.Save();
            return true;
        }

        public async Task<bool> UpdateCollectionAsync(int id, string userId, CollectionCreateDto dto)
        {
            var collection = await unitofwork.Collections.Query()
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

            if (collection == null) return false;

            collection.Name = dto.Name;
            collection.UpdatedAt = DateTime.UtcNow;
            unitofwork.Collections.Update(collection);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> AddGameToCollectionAsync(int collectionId, int gameId, string userId)
        {
            // Verify collection belongs to user
            var collection = await unitofwork.Collections.Query()
                .FirstOrDefaultAsync(c => c.Id == collectionId && c.UserId == userId);
            if (collection == null) return false;

            // Check if already in collection
            var exists = await unitofwork.CollectionGames.Query()
                .AnyAsync(cg => cg.CollectionId == collectionId && cg.GameId == gameId);
            if (exists) return true;

            var collectionGame = new CollectionGame
            {
                CollectionId = collectionId,
                GameId = gameId
            };

            await unitofwork.CollectionGames.Add(collectionGame);
            collection.UpdatedAt = DateTime.UtcNow;
            unitofwork.Collections.Update(collection);
            unitofwork.Save();
            return true;
        }

        public async Task<bool> RemoveGameFromCollectionAsync(int collectionId, int gameId, string userId)
        {
            // Verify collection belongs to user
            var collection = await unitofwork.Collections.Query()
                .FirstOrDefaultAsync(c => c.Id == collectionId && c.UserId == userId);
            if (collection == null) return false;

            var collectionGame = await unitofwork.CollectionGames.Query()
                .FirstOrDefaultAsync(cg => cg.CollectionId == collectionId && cg.GameId == gameId);

            if (collectionGame == null) return false;

            await unitofwork.CollectionGames.DeleteAsync(collectionGame);
            collection.UpdatedAt = DateTime.UtcNow;
            unitofwork.Collections.Update(collection);
            unitofwork.Save();
            return true;
        }

        public async Task<IEnumerable<int>> GetGameCollectionIdsAsync(int gameId, string userId)
        {
            return await unitofwork.CollectionGames.Query()
                .Where(cg => cg.GameId == gameId && cg.Collection.UserId == userId)
                .Select(cg => cg.CollectionId)
                .ToListAsync();
        }
    }
}
