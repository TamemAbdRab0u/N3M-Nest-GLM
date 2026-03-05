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
using System.Text.Json;

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

        public async Task<IEnumerable<RAWGCatalogDto>> GetAllGamesAsync(int page = 1, string? genre = null, string? platforms = null, string? ordering = null, string? dates = null)
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/games?key={key}&page={page}&page_size=12";
            if (!string.IsNullOrEmpty(genre))
            {
                url += $"&genres={genre.ToLower()}";
            }
            if (!string.IsNullOrEmpty(platforms))
            {
                url += $"&parent_platforms={platforms}";
            }
            if (!string.IsNullOrEmpty(ordering))
            {
                url += $"&ordering={ordering}";
            }
            if (!string.IsNullOrEmpty(dates))
            {
                url += $"&dates={dates}";
            }

            var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);
            var games = response.Results.Select(g => new RAWGCatalogDto
            {
                ExternalId = g.Id,
                Title = g.Name,
                ImageUrl = g.Background_Image,
                Rating = g.Rating,
                Metacritic = g.Metacritic,
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
                    .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus, ug.IsInWishlist })
                    .ToListAsync();

                foreach (var game in games)
                {
                    var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                    if (userGame != null)
                    {
                        game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                        game.IsInWishlist = userGame.IsInWishlist;
                        game.IsFavorite = userGame.IsFavorite;
                    }
                }
            }

            return games;
        }

        public async Task<IEnumerable<string>> GetAllGenresAsync()
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/genres?key={key}";
            
            try 
            {
                var response = await _http.GetFromJsonAsync<JsonElement>(url);
                if (response.TryGetProperty("results", out var results))
                {
                    return results.EnumerateArray()
                        .Select(g => $"{g.GetProperty("slug").GetString()}:{g.GetProperty("name").GetString()}")
                        .ToList();
                }
                return Enumerable.Empty<string>();
            }
            catch
            {
                return Enumerable.Empty<string>();
            }
        }

        public async Task<IEnumerable<string>> GetAllPlatformsAsync()
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/platforms/lists/parents?key={key}";
            
            try 
            {
                var response = await _http.GetFromJsonAsync<JsonElement>(url);
                if (response.TryGetProperty("results", out var results))
                {
                    return results.EnumerateArray()
                        .Select(p => $"{p.GetProperty("id").GetInt32()}:{p.GetProperty("name").GetString()}")
                        .ToList();
                }
                return Enumerable.Empty<string>();
            }
            catch
            {
                return Enumerable.Empty<string>();
            }
        }

        public async Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query)
        {
            var key = _config["RAWG:ApiKey"];
            // Request more than we need to allow for filtering and better ranking
            var url = $"https://api.rawg.io/api/games?key={key}&search={query}&page_size=40";

            var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);

            if (response?.Results == null) return Enumerable.Empty<RAWGCatalogDto>();

            // Filter out results that are likely irrelevant "junk":
            // - No background image AND
            // - Has no ratings AND
            // - Has very few people who "added" it (popularity metric)
            // BUT: We keep them if the title is an exact match for the query (case insensitive)
            var filteredResults = response.Results.Where(g => 
                !string.IsNullOrEmpty(g.Background_Image) || 
                g.Rating > 0 || 
                g.Added > 10 || 
                g.Metacritic.HasValue ||
                g.Name.Equals(query, StringComparison.OrdinalIgnoreCase)
            ).ToList();

            // If we filtered too much, fallback to original results (safety first)
            var resultsToUse = filteredResults.Count > 0 ? filteredResults : response.Results;

            // Sort by popularity (Added count) to bring important releases/DLCs to the top
            // while preserving the relevancy (since they are already from a search query)
            var games = resultsToUse
                .OrderByDescending(g => g.Added)
                .ThenByDescending(g => g.Rating)
                .Take(15) // Return slightly more than 12 for better user experience
                .Select(g => new RAWGCatalogDto
                {
                    ExternalId = g.Id,
                    Title = g.Name,
                    ImageUrl = g.Background_Image,
                    Rating = g.Rating,
                    Metacritic = g.Metacritic,
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
                    .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus, ug.IsInWishlist })
                    .ToListAsync();

                foreach (var game in games)
                {
                    var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                    if (userGame != null)
                    {
                        game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                        game.IsInWishlist = userGame.IsInWishlist;
                        game.IsFavorite = userGame.IsFavorite;
                    }
                }
            }

            return games;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetGamesByExternalIdsAsync(List<int> externalIds)
        {
            if (externalIds == null || externalIds.Count == 0)
                return Enumerable.Empty<RAWGCatalogDto>();

            var key = _config["RAWG:ApiKey"];
            var allResults = new List<RAWGCatalogDto>();

            // RAWG has a maximum page_size limit (usually 40), so we chunk requests for safety
            const int CHUNK_SIZE = 40;
            for (int i = 0; i < externalIds.Count; i += CHUNK_SIZE)
            {
                var chunk = externalIds.Skip(i).Take(CHUNK_SIZE).ToList();
                var idsString = string.Join(",", chunk);
                var url = $"https://api.rawg.io/api/games?key={key}&ids={idsString}&page_size={CHUNK_SIZE}";

                try
                {
                    var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);
                    if (response != null && response.Results != null)
                    {
                        var games = response.Results.Select(g => new RAWGCatalogDto
                        {
                            ExternalId = g.Id,
                            Title = g.Name,
                            ImageUrl = g.Background_Image,
                            Rating = g.Rating,
                            Metacritic = g.Metacritic,
                            ReleaseDate = g.Released,
                            Genres = g.Genres?.Select(genre => genre.Name).ToList() ?? new List<string>(),
                            Platforms = g.Parent_Platforms?.Select(p => p.Platform.Slug).ToList() ?? new List<string>()
                        });
                        allResults.AddRange(games);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error fetching chunk of RAWG IDs: {ex.Message}");
                    // Continue to next chunk instead of returning empty
                }
            }

            return allResults;
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
                // No row yet — create one flagged as favorite only (no library, no wishlist)
                userGame = new UserGame
                {
                    UserId = userId,
                    GameId = game.Id,
                    IsFavorite = true,
                    IsInWishlist = false,
                    Gamestatus = Gamestatus.whishlist, // sentinel: exists but not in library
                    Rating = 0
                };
                await unitofwork.UserGames.Add(userGame);
                unitofwork.Save();
                return true;
            }

            // Block: game is on wishlist
            if (userGame.IsInWishlist)
                return false;

            userGame.IsFavorite = !userGame.IsFavorite;

            // If nothing keeps this row alive, delete it
            bool hasLibrary = userGame.Gamestatus != Gamestatus.whishlist;
            if (!userGame.IsFavorite && !hasLibrary && !userGame.IsInWishlist)
            {
                await unitofwork.UserGames.DeleteAsync(userGame);
                unitofwork.Save();
                return false;
            }

            await unitofwork.UserGames.Update(userGame);
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
                bool currentlyInLibrary = userGame.Gamestatus != Gamestatus.whishlist;

                // Block: game is on wishlist (only allow toggle-off if already in library)
                if (!currentlyInLibrary && userGame.IsInWishlist)
                    return false;

                if (currentlyInLibrary)
                {
                    // Remove from library — keep row alive if still favorited or wishlisted
                    userGame.Gamestatus = Gamestatus.whishlist; // sentinel: not in library
                    if (!userGame.IsFavorite && !userGame.IsInWishlist)
                    {
                        await unitofwork.UserGames.DeleteAsync(userGame);
                    }
                    else
                    {
                        await unitofwork.UserGames.Update(userGame);
                    }
                    unitofwork.Save();
                    return false;
                }
                else
                {
                    // Row exists but not in library — add to library (preserve wishlist & favorite)
                    userGame.Gamestatus = Gamestatus.Pending;
                    userGame.AddedAt = DateTime.UtcNow;
                    await unitofwork.UserGames.Update(userGame);
                    unitofwork.Save();
                    return true;
                }
            }

            // Brand new entry — add to library only
            userGame = new UserGame
            {
                UserId = userId,
                GameId = game.Id,
                IsFavorite = false,
                IsInWishlist = false,
                Gamestatus = Gamestatus.Pending,
                Rating = 0,
                AddedAt = DateTime.UtcNow
            };

            await unitofwork.UserGames.Add(userGame);
            unitofwork.Save();
            return true;
        }

        public async Task<bool> ToggleWishlistAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await unitofwork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame != null)
            {
                // Block: game is in library or marked as favorite
                bool currentlyInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                if (!userGame.IsInWishlist && (currentlyInLibrary || userGame.IsFavorite))
                    return false;

                // Simply toggle the dedicated bool — never touches library status or favorite
                userGame.IsInWishlist = !userGame.IsInWishlist;

                if (!userGame.IsInWishlist)
                {
                    // Removing from wishlist — delete row if nothing else keeps it
                    bool hasLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                    if (!hasLibrary && !userGame.IsFavorite)
                    {
                        await unitofwork.UserGames.DeleteAsync(userGame);
                        unitofwork.Save();
                        return false;
                    }
                }

                await unitofwork.UserGames.Update(userGame);
                unitofwork.Save();
                return userGame.IsInWishlist;
            }

            // Brand new entry — wishlist only (no library status)
            userGame = new UserGame
            {
                UserId = userId,
                GameId = game.Id,
                IsFavorite = false,
                IsInWishlist = true,
                Gamestatus = Gamestatus.whishlist, // sentinel: not in library
                Rating = 0
            };

            await unitofwork.UserGames.Add(userGame);
            unitofwork.Save();
            return true;
        }

        public async Task<RAWGGameDetailsDto> GetGameDetailsAsync(int externalId)
        {
            var key = _config["RAWG:ApiKey"];

            // Fetch core game details
            var detailUrl = $"https://api.rawg.io/api/games/{externalId}?key={key}";
            var screenshotsUrl = $"https://api.rawg.io/api/games/{externalId}/screenshots?key={key}";
            var moviesUrl = $"https://api.rawg.io/api/games/{externalId}/movies?key={key}";

            var detailTask = _http.GetFromJsonAsync<JsonElement>(detailUrl);
            var screenshotsTask = _http.GetFromJsonAsync<JsonElement>(screenshotsUrl);
            var moviesTask = _http.GetFromJsonAsync<JsonElement>(moviesUrl);

            await Task.WhenAll(detailTask, screenshotsTask, moviesTask);

            var detail = detailTask.Result;
            var dto = new RAWGGameDetailsDto
            {
                ExternalId = detail.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : externalId,
                Title = detail.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "",
                Description = detail.TryGetProperty("description_raw", out var descProp) ? descProp.GetString() : "",
                BackgroundImage = detail.TryGetProperty("background_image", out var bgProp) ? bgProp.GetString() : "",
                BackgroundImageAdditional = detail.TryGetProperty("background_image_additional", out var bgAddProp) ? bgAddProp.GetString() : "",
                Rating = detail.TryGetProperty("rating", out var ratingProp) ? ratingProp.GetDouble() : 0,
                RatingTop = detail.TryGetProperty("rating_top", out var rTopProp) ? rTopProp.GetInt32() : 0,
                RatingsCount = detail.TryGetProperty("ratings_count", out var rcProp) ? rcProp.GetInt32() : 0,
                ReleaseDate = detail.TryGetProperty("released", out var relProp) ? relProp.GetString() : "",
                Metacritic = detail.TryGetProperty("metacritic", out var mcProp) && mcProp.ValueKind == JsonValueKind.Number ? mcProp.GetInt32() : null,
                Playtime = detail.TryGetProperty("playtime", out var ptProp) ? ptProp.GetInt32() : 0,
                Website = detail.TryGetProperty("website", out var webProp) ? webProp.GetString() : "",
                EsrbRating = detail.TryGetProperty("esrb_rating", out var esrbProp) && esrbProp.ValueKind == JsonValueKind.Object
                    ? (esrbProp.TryGetProperty("name", out var esrbName) ? esrbName.GetString() : null)
                    : null,
            };

            // Genres
            if (detail.TryGetProperty("genres", out var genresProp) && genresProp.ValueKind == JsonValueKind.Array)
                dto.Genres = genresProp.EnumerateArray()
                    .Where(g => g.TryGetProperty("name", out _))
                    .Select(g => g.GetProperty("name").GetString())
                    .ToList();

            // Platforms
            if (detail.TryGetProperty("parent_platforms", out var platsProp) && platsProp.ValueKind == JsonValueKind.Array)
                dto.Platforms = platsProp.EnumerateArray()
                    .Where(p => p.TryGetProperty("platform", out var pl) && pl.TryGetProperty("name", out _))
                    .Select(p => p.GetProperty("platform").GetProperty("name").GetString())
                    .ToList();

            // Tags (top 10)
            if (detail.TryGetProperty("tags", out var tagsProp) && tagsProp.ValueKind == JsonValueKind.Array)
                dto.Tags = tagsProp.EnumerateArray()
                    .Where(t => t.TryGetProperty("language", out var lang) && lang.GetString() == "eng" && t.TryGetProperty("name", out _))
                    .Take(10)
                    .Select(t => t.GetProperty("name").GetString())
                    .ToList();

            // Requirements (from platforms -> requirements_en)
            if (detail.TryGetProperty("platforms", out var platformsFull) && platformsFull.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in platformsFull.EnumerateArray())
                {
                    if (p.TryGetProperty("platform", out var plat) && plat.TryGetProperty("slug", out var slug) && slug.GetString() == "pc")
                    {
                        if (p.TryGetProperty("requirements", out var reqs) && reqs.ValueKind == JsonValueKind.Object)
                        {
                            if (reqs.TryGetProperty("minimum", out var min)) dto.MinimumRequirements = min.GetString();
                            if (reqs.TryGetProperty("recommended", out var rec)) dto.RecommendedRequirements = rec.GetString();
                        }
                        break;
                    }
                }
            }

            // Developers
            if (detail.TryGetProperty("developers", out var devsProp) && devsProp.ValueKind == JsonValueKind.Array)
                dto.Developers = devsProp.EnumerateArray()
                    .Where(d => d.TryGetProperty("name", out _))
                    .Select(d => d.GetProperty("name").GetString())
                    .ToList();

            // Publishers
            if (detail.TryGetProperty("publishers", out var pubsProp) && pubsProp.ValueKind == JsonValueKind.Array)
                dto.Publishers = pubsProp.EnumerateArray()
                    .Where(p => p.TryGetProperty("name", out _))
                    .Select(p => p.GetProperty("name").GetString())
                    .ToList();

            // Trailer from clip (short preview) or movies
            if (detail.TryGetProperty("clip", out var clipProp) && clipProp.ValueKind == JsonValueKind.Object)
            {
                if (clipProp.TryGetProperty("clip", out var clipUrl)) dto.TrailerUrl = clipUrl.GetString();
                if (clipProp.TryGetProperty("preview", out var clipPreview)) dto.TrailerPreview = clipPreview.GetString();
            }

            // Screenshots
            try
            {
                var screenshots = screenshotsTask.Result;
                if (screenshots.TryGetProperty("results", out var ssResults) && ssResults.ValueKind == JsonValueKind.Array)
                    dto.Screenshots = ssResults.EnumerateArray()
                        .Where(s => s.TryGetProperty("image", out _))
                        .Select(s => s.GetProperty("image").GetString())
                        .ToList();
            }
            catch { /* screenshots optional */ }

            // Movies / trailers (override clip if a proper trailer exists)
            try
            {
                var movies = moviesTask.Result;
                if (movies.TryGetProperty("results", out var mvResults) && mvResults.ValueKind == JsonValueKind.Array)
                {
                    var firstMovie = mvResults.EnumerateArray().FirstOrDefault();
                    if (firstMovie.ValueKind == JsonValueKind.Object)
                    {
                        if (firstMovie.TryGetProperty("data", out var dataProp) && dataProp.ValueKind == JsonValueKind.Object)
                        {
                            // Prefer 480 quality, fall back to max
                            if (dataProp.TryGetProperty("480", out var p480)) dto.TrailerUrl = p480.GetString();
                            else if (dataProp.TryGetProperty("max", out var pMax)) dto.TrailerUrl = pMax.GetString();
                        }
                        if (string.IsNullOrEmpty(dto.TrailerPreview) && firstMovie.TryGetProperty("preview", out var mvPreview))
                            dto.TrailerPreview = mvPreview.GetString();
                    }
                }
            }
            catch { /* movies optional */ }

            // Populate user state if authenticated
            var userId = GetCurrentUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                var game = await unitofwork.Games.Query().FirstOrDefaultAsync(g => g.ExternalId == externalId);
                if (game != null)
                {
                    var userGame = await unitofwork.UserGames.Query()
                        .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);
                    if (userGame != null)
                    {
                        dto.IsFavorite = userGame.IsFavorite;
                        dto.IsInWishlist = userGame.IsInWishlist;
                        dto.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                    }
                }
            }

            return dto;
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

        public async Task<IEnumerable<RAWGCatalogDto>> GetSimilarGamesAsync(int externalId)
        {
            var key = _config["RAWG:ApiKey"];

            // RAWG provides a dedicated endpoint for games in the same series / similar titles
            var url = $"https://api.rawg.io/api/games/{externalId}/suggested?key={key}&page_size=6";

            try
            {
                var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);
                if (response?.Results == null || !response.Results.Any())
                    return Enumerable.Empty<RAWGCatalogDto>();

                var games = response.Results
                    .Where(g => !string.IsNullOrEmpty(g.Background_Image))
                    .Take(6)
                    .Select(g => new RAWGCatalogDto
                    {
                        ExternalId = g.Id,
                        Title = g.Name,
                        ImageUrl = g.Background_Image,
                        Rating = g.Rating,
                        Metacritic = g.Metacritic,
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
                        .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus, ug.IsInWishlist })
                        .ToListAsync();

                    foreach (var game in games)
                    {
                        var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                        if (userGame != null)
                        {
                            game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                            game.IsInWishlist = userGame.IsInWishlist;
                            game.IsFavorite = userGame.IsFavorite;
                        }
                    }
                }

                return games;
            }
            catch
            {
                return Enumerable.Empty<RAWGCatalogDto>();
            }
        }
    }
}
