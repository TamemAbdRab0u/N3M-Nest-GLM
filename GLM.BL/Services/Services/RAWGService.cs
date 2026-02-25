using Game_Library_Management_BL.DTO_s.RAWGDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace Game_Library_Management_BL.Services.Services
{
    public class RAWGService : IRAWGService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;
        private readonly IUnitOfWork unitofwork;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public RAWGService(HttpClient http, IConfiguration config, IUnitOfWork unitofwork, IHttpContextAccessor httpContextAccessor)
        {
            _http = http;
            _config = config;
            this.unitofwork = unitofwork;
            _httpContextAccessor = httpContextAccessor;
        }

        private string GetCurrentUserId()
        {
            return _httpContextAccessor.HttpContext?.User?.FindFirstValue("uid");
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetAllGamesAsync(int page = 1)
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/games?key={key}&page={page}&page_size=20";

            var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);
            var games = response.Results.Select(g => new RAWGCatalogDto
            {
                ExternalId = g.Id,
                Title = g.Name,
                ImageUrl = g.Background_Image,
                Rating = g.Rating,
                ReleaseDate = g.Released,
                Genres = g.Genres?.Select(genre => genre.Name).ToList() ?? new List<string>(),
                Platforms = g.Parent_Platforms?.Select(p => p.Platform.Slug).ToList() ?? new List<string>()
            }).ToList();

            var userId = GetCurrentUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                var userGames = await unitofwork.UserGames.Query()
                    .Include(ug => ug.Game)
                    .Where(ug => ug.UserId == userId)
                    .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus })
                    .ToListAsync();

                foreach (var game in games)
                {
                    var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                    if (userGame != null)
                    {
                        game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                        game.IsFavorite = userGame.IsFavorite;
                    }
                }
            }

            return games;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query)
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/games?key={key}&search={query}&page_size=20";

            var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);

            var games = response.Results.Select(g => new RAWGCatalogDto
            {
                ExternalId = g.Id,
                Title = g.Name,
                ImageUrl = g.Background_Image,
                Rating = g.Rating,
                ReleaseDate = g.Released,
                Genres = g.Genres?.Select(genre => genre.Name).ToList() ?? new List<string>(),
                Platforms = g.Parent_Platforms?.Select(p => p.Platform.Slug).ToList() ?? new List<string>()
            }).ToList();

            var userId = GetCurrentUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                var userGames = await unitofwork.UserGames.Query()
                    .Include(ug => ug.Game)
                    .Where(ug => ug.UserId == userId)
                    .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus }) // Updated Projection
                    .ToListAsync();

                foreach (var game in games)
                {
                    var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                    if (userGame != null)
                    {
                        // Check if in library based on status
                        game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                        game.IsFavorite = userGame.IsFavorite;
                    }
                }
            }

            return games;
        }

        public async Task<bool> ImportGamesAsync(IEnumerable<RAWGCatalogDto> games)
        {
            foreach (var g in games)
            {
                var exists = await unitofwork.Games.Query().AnyAsync(x => x.ExternalId == g.ExternalId);

                if (exists) continue;

                var game = new Game
                {
                    ExternalId = g.ExternalId,
                    Title = g.Title,
                    ImgUrl = g.ImageUrl,
                    ReleaseDate = DateTime.TryParse(g.ReleaseDate, out var d) ? d : null
                };

               await unitofwork.Games.Add(game);
            }

            unitofwork.Save();
            return true;
        }

        public async Task<bool> ToggleFavoriteAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await unitofwork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame == null)
            {
                userGame = new UserGame
                {
                    UserId = userId,
                    GameId = game.Id,
                    IsFavorite = true,
                    Gamestatus = Gamestatus.whishlist, // Default for favorites
                    Rating = 0 // Initialize
                };
                await unitofwork.UserGames.Add(userGame);
            }
            else
            {
                userGame.IsFavorite = !userGame.IsFavorite;
                unitofwork.UserGames.Update(userGame);
            }

            unitofwork.Save();
            return userGame.IsFavorite;
        }

        public async Task<bool> AddToLibraryAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await unitofwork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame != null)
            {
                // Toggle Logic:
                // If currently "In Library" (not just wishlist), remove.
                // If currently "Not in Library" (wishlist or null), add.
                
                // Check if currently considered "In Library" (Playing/Completed/etc)
                bool currentlyInLibrary = userGame.Gamestatus != Gamestatus.whishlist;

                if (currentlyInLibrary)
                {
                    // Remove from library
                    if (userGame.IsFavorite)
                    {
                        // Downgrade to just favorite (wishlist)
                        userGame.Gamestatus = Gamestatus.whishlist;
                        unitofwork.UserGames.Update(userGame);
                        unitofwork.Save();
                        return false; // Result: Not in library
                    }
                    else
                    {
                        // Not favorite, so just delete
                        unitofwork.UserGames.DeleteAsync(userGame);
                        unitofwork.Save();
                        return false; // Result: Not in library
                    }
                }
                else
                {
                    // Currently wishlist (favorite only), so upgrade to library
                    userGame.Gamestatus = Gamestatus.playing;
                    unitofwork.UserGames.Update(userGame);
                    unitofwork.Save();
                    return true; // Result: In library
                }
            }

            // New entry -> Add to library
            userGame = new UserGame
            {
                UserId = userId,
                GameId = game.Id,
                IsFavorite = false,
                Gamestatus = Gamestatus.playing,
                Rating = 0
            };

            await unitofwork.UserGames.Add(userGame);
            unitofwork.Save();
            return true;
        }

        private async Task<Game> EnsureGameExistsAsync(int externalId)
        {
            var game = await unitofwork.Games.Query().FirstOrDefaultAsync(g => g.ExternalId == externalId);
            if (game != null) return game;

            // Fetch from RAWG
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/games/{externalId}?key={key}";
            
            try 
            {
                var response = await _http.GetFromJsonAsync<RAWGGameDto>(url);
                if (response == null) return null;

                game = new Game
                {
                    ExternalId = response.Id,
                    Title = response.Name,
                    ImgUrl = response.Background_Image,
                    ReleaseDate = DateTime.TryParse(response.Released, out var d) ? d : null
                };

                await unitofwork.Games.Add(game);
                unitofwork.Save();
                return game;
            }
            catch
            {
                return null;
            }
        }
    }
}
