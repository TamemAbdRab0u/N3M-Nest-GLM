using Game_Library_Management_BL.DTO_s.RAWGDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Game_Library_Management_PL.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class SteamService : ISteamService
    {
        private readonly HttpClient _http;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _config;

        private const int PageSize = 12;
        private const string CatalogFeedVersion = "v3";
        private static readonly TimeSpan CatalogCacheTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan SearchCacheTtl = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan AppDetailsCacheTtl = TimeSpan.FromHours(12);
        private static readonly TimeSpan StaleThreshold = TimeSpan.FromDays(7);
        private static readonly TimeSpan RefreshLockTtl = TimeSpan.FromHours(6);

        private static readonly string[] DefaultGenres =
        {
            "action:Action", "adventure:Adventure", "rpg:RPG", "strategy:Strategy", "indie:Indie",
            "simulation:Simulation", "sports:Sports", "racing:Racing", "casual:Casual", "fps:FPS"
        };

        public SteamService(HttpClient http, IUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor, IMemoryCache cache, IConfiguration config)
        {
            _http = http;
            _unitOfWork = unitOfWork;
            _httpContextAccessor = httpContextAccessor;
            _cache = cache;
            _config = config;
        }

        private string? GetCurrentUserId()
        {
            return _httpContextAccessor.HttpContext?.User?.FindFirstValue("uid");
        }

        public async Task<IEnumerable<string>> GetAllGenresAsync()
        {
            var tags = await _unitOfWork.Tags.Query()
                .OrderBy(x => x.Name)
                .Select(x => string.IsNullOrWhiteSpace(x.Slug) ? Slugify(x.Name) + ":" + x.Name : x.Slug + ":" + x.Name)
                .ToListAsync();

            return tags.Count > 0 ? tags : DefaultGenres;
        }

        public async Task<IEnumerable<string>> GetAllPlatformsAsync()
        {
            var platforms = await _unitOfWork.Platforms.Query()
                .OrderBy(x => x.Id)
                .Select(x => x.Id + ":" + x.Name)
                .ToListAsync();

            if (platforms.Count > 0) return platforms;

            return new[] { "1:PC", "2:Mac", "3:Linux" };
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetAllGamesAsync(int page = 1, string? genre = null, string? platforms = null, string? ordering = null, string? dates = null)
        {
            var cacheKey = $"steam:catalog:{CatalogFeedVersion}:{page}:{genre}:{platforms}:{ordering}:{dates}";
            if (!_cache.TryGetValue(cacheKey, out List<RAWGCatalogDto>? cachedCatalog))
            {
                var candidates = await GetCatalogFromDatabaseAsync();
                if (candidates.Count < 300)
                {
                    candidates = await FetchFeaturedCatalogAsync();
                }

                if (!string.IsNullOrWhiteSpace(platforms))
                {
                    candidates = candidates.Where(g => MatchesPlatformFilter(g, platforms)).ToList();
                }

                if (!string.IsNullOrWhiteSpace(genre))
                {
                    var enriched = await EnrichCatalogByIdsAsync(candidates.Select(c => c.ExternalId).Take(60).ToList());
                    var filtered = enriched.Where(g => g.Genres.Any(x => Normalize(x).Contains(Normalize(genre)) || Normalize(genre).Contains(Normalize(x)))).ToList();
                    candidates = filtered.Count > 0 ? filtered : candidates;
                }

                if (!string.IsNullOrWhiteSpace(dates))
                {
                    var range = ParseDateRange(dates);
                    if (range != null)
                    {
                        candidates = candidates.Where(g => DateFallsInRange(g.ReleaseDate, range.Value.from, range.Value.to)).ToList();
                    }
                }

                candidates = ApplyOrdering(candidates, ordering);

                cachedCatalog = candidates
                    .Skip(Math.Max(0, (page - 1) * PageSize))
                    .Take(PageSize)
                    .Select(CloneCatalogDto)
                    .ToList();

                _cache.Set(cacheKey, cachedCatalog, CatalogCacheTtl);
            }

            var paged = cachedCatalog!.Select(CloneCatalogDto).ToList();

            await PopulateUserStatesAsync(paged);
            return paged;
        }

        public async Task<(int Requested, int Stored, int Updated, int Failed)> PreloadPopularGamesAsync(int take = 1000, int hydrateTop = 200, int skip = 0)
        {
            take = Math.Clamp(take, 1, 2000);
            skip = Math.Clamp(skip, 0, 200000);
            hydrateTop = Math.Clamp(hydrateTop, 0, take);

            var rankedApps = await FetchSteamSpyPopularAppsAsync(take + skip);
            if (rankedApps.Count == 0)
            {
                return (take, 0, 0, take);
            }

            var selected = rankedApps.Skip(skip).Take(take).ToList();
            if (selected.Count == 0)
            {
                return (0, 0, 0, 0);
            }

            var hydrateSet = selected.Take(hydrateTop).Select(x => x.appId).ToHashSet();

            var stored = 0;
            var updated = 0;
            var failed = 0;

            foreach (var app in selected)
            {
                try
                {
                    var existing = await _unitOfWork.Games.Query().FirstOrDefaultAsync(g => g.ExternalId == app.appId);

                    if (hydrateSet.Contains(app.appId))
                    {
                        var details = await GetSteamAppDetailsAsync(app.appId);
                        if (details != null)
                        {
                            var game = existing ?? new Game { ExternalId = app.appId };
                            var isNew = existing == null;

                            await UpsertGameAggregateAsync(game, details.Value, isNew);
                            if (isNew) stored++; else updated++;
                            continue;
                        }
                    }

                    if (existing == null)
                    {
                        var newGame = new Game
                        {
                            ExternalId = app.appId,
                            Title = string.IsNullOrWhiteSpace(app.name) ? $"Steam App {app.appId}" : app.name,
                            ImgUrl = $"https://cdn.akamai.steamstatic.com/steam/apps/{app.appId}/header.jpg",
                            PosterImageUrl = BuildSteamPosterImageUrl(app.appId),
                            IsDetailsHydrated = false,
                            DetailsLastSyncedAt = null
                        };

                        await _unitOfWork.Games.Add(newGame);
                        _unitOfWork.Save();
                        stored++;
                    }
                    else
                    {
                        var changed = false;

                        if (string.IsNullOrWhiteSpace(existing.Title) && !string.IsNullOrWhiteSpace(app.name))
                        {
                            existing.Title = app.name;
                            changed = true;
                        }

                        if (string.IsNullOrWhiteSpace(existing.ImgUrl))
                        {
                            existing.ImgUrl = $"https://cdn.akamai.steamstatic.com/steam/apps/{app.appId}/header.jpg";
                            changed = true;
                        }

                        if (string.IsNullOrWhiteSpace(existing.PosterImageUrl))
                        {
                            existing.PosterImageUrl = BuildSteamPosterImageUrl(app.appId);
                            changed = true;
                        }

                        if (changed)
                        {
                            await _unitOfWork.Games.Update(existing);
                            _unitOfWork.Save();
                            updated++;
                        }
                    }
                }
                catch
                {
                    failed++;
                }
            }

            InvalidateDefaultCatalogCachePages();

            return (selected.Count, stored, updated, failed);
        }

        public async Task<(int Total, int Updated, int Skipped, int Failed, List<(int ExternalId, string TrailerUrl)> Results)>
            SyncAchievementsAndTrailersAsync(bool overwriteExisting = false, CancellationToken cancellationToken = default)
        {
            var games = await _unitOfWork.Games.Query()
                .Where(g => g.ExternalId > 0)
                .ToListAsync(cancellationToken);

            var total = games.Count;
            var updated = 0;
            var skipped = 0;
            var failed = 0;
            var results = new List<(int ExternalId, string TrailerUrl)>();

            foreach (var game in games)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!overwriteExisting && !string.IsNullOrWhiteSpace(game.TrailerUrl))
                {
                    skipped++;
                    results.Add((game.ExternalId, game.TrailerUrl));
                    continue;
                }

                try
                {
                    // Delay to respect rate limits
                    await Task.Delay(1500, cancellationToken);
                    
                    var details = await GetSteamAppDetailsAsync(game.ExternalId, forceRefresh: overwriteExisting);
                    if (details == null)
                    {
                        Console.WriteLine($"[Sync] Failed to fetch details for {game.ExternalId}");
                        failed++;
                        continue;
                    }

                    var trailerUrl = details.Value.trailerUrl ?? "";
                    
                    // Only update if it actually changed or we are forcing overwrite
                    if (game.TrailerUrl != trailerUrl || overwriteExisting)
                    {
                        game.TrailerUrl = trailerUrl;
                        game.TrailerPreview = details.Value.trailerPreview ?? "";
                        game.AchievementsCount = details.Value.achievementsCount;
                        
                        await _unitOfWork.Games.Update(game);
                        _unitOfWork.Save();
                        
                        // Also sync trailers bridge table
                        await ReplaceTrailersAsync(game.Id, game.TrailerUrl, game.TrailerPreview);
                        
                        updated++;
                        Console.WriteLine($"[Sync] Updated {game.ExternalId}: {trailerUrl}");
                    }
                    else
                    {
                        skipped++;
                    }

                    results.Add((game.ExternalId, trailerUrl));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Sync] Error processing {game.ExternalId}: {ex.Message}");
                    failed++;
                }
            }

            return (total, updated, skipped, failed, results);
        }



        public async Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return Enumerable.Empty<RAWGCatalogDto>();

            var cacheKey = $"steam:search:{query.Trim().ToLowerInvariant()}";
            if (!_cache.TryGetValue(cacheKey, out List<RAWGCatalogDto>? cachedSearch))
            {
                var appIds = await SearchSteamAppIdsAsync(query, 10);
                if (!appIds.Any()) return Enumerable.Empty<RAWGCatalogDto>();

                var games = await EnrichCatalogByIdsAsync(appIds.Take(10).ToList());
                cachedSearch = games
                    .OrderByDescending(g => SimilarityScore(g.Title, query))
                    .ThenByDescending(g => g.Rating)
                    .Take(10)
                    .Select(CloneCatalogDto)
                    .ToList();

                _cache.Set(cacheKey, cachedSearch, SearchCacheTtl);
            }

            var ranked = cachedSearch!.Select(CloneCatalogDto).ToList();

            await PopulateUserStatesAsync(ranked);
            return ranked;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetGamesByExternalIdsAsync(List<int> externalIds)
        {
            if (externalIds == null || externalIds.Count == 0)
                return Enumerable.Empty<RAWGCatalogDto>();

            var ids = externalIds.Distinct().ToList();

            var fromDb = await _unitOfWork.Games.Query()
                .Include(g => g.GameTags).ThenInclude(gt => gt.Tag)
                .Include(g => g.GamePlatforms).ThenInclude(gp => gp.Platform)
                .Where(g => ids.Contains(g.ExternalId))
                .ToListAsync();

            var map = fromDb.ToDictionary(g => g.ExternalId, MapGameToCatalogDto);
            var missing = ids.Where(id => !map.ContainsKey(id)).ToList();

            if (missing.Count > 0)
            {
                var fromApi = await EnrichCatalogByIdsAsync(missing);
                foreach (var game in fromApi)
                {
                    map[game.ExternalId] = game;
                }
            }

            var ordered = ids.Where(map.ContainsKey).Select(id => map[id]).ToList();
            await PopulateUserStatesAsync(ordered);
            return ordered;
        }

        public async Task<RAWGGameDetailsDto> GetGameDetailsAsync(int externalId)
        {
            var userId = GetCurrentUserId();
            var existing = await LoadGameAggregateAsync(externalId);

            if (existing != null && existing.IsDetailsHydrated)
            {
                if (ShouldRefresh(existing))
                {
                    var refreshKey = $"steam:details:refresh-lock:{externalId}";
                    if (!_cache.TryGetValue(refreshKey, out _))
                    {
                        _cache.Set(refreshKey, true, RefreshLockTtl);
                        var latest = await GetSteamAppDetailsAsync(externalId, forceRefresh: true);
                        if (latest != null)
                        {
                            await UpsertGameAggregateAsync(existing, latest.Value, false);
                            _unitOfWork.Save();
                            existing = await LoadGameAggregateAsync(externalId) ?? existing;
                        }
                    }
                }

                var fromDb = MapGameToDetailsDto(existing);
                await PopulateDetailsUserStateAsync(fromDb, existing.Id, userId);
                return fromDb;
            }

            var details = await GetSteamAppDetailsAsync(externalId);
            if (details == null) return null;

            var game = existing ?? new Game { ExternalId = externalId };
            var isNew = existing == null;

            await UpsertGameAggregateAsync(game, details.Value, isNew);
            _unitOfWork.Save();

            var hydrated = await LoadGameAggregateAsync(externalId);
            if (hydrated == null) return null;

            var dto = MapGameToDetailsDto(hydrated);
            await PopulateDetailsUserStateAsync(dto, hydrated.Id, userId);
            return dto;
        }

        public async Task<bool> ImportGamesAsync(IEnumerable<RAWGCatalogDto> games)
        {
            foreach (var g in games)
            {
                var exists = await _unitOfWork.Games.Query().AnyAsync(x => x.ExternalId == g.ExternalId);
                if (exists) continue;

                var game = new Game
                {
                    ExternalId = g.ExternalId,
                    Title = g.Title,
                    ImgUrl = g.ImageUrl,
                    Rating = g.Rating,
                    Metacritic = g.Metacritic,
                    ReleaseDate = DateTime.TryParse(g.ReleaseDate, out var d) ? d : null
                };

                await _unitOfWork.Games.Add(game);
            }

            _unitOfWork.Save();
            return true;
        }

        public async Task<bool> ToggleFavoriteAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await _unitOfWork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame == null)
            {
                userGame = new UserGame
                {
                    UserId = userId,
                    GameId = game.Id,
                    IsFavorite = true,
                    IsInWishlist = false,
                    Gamestatus = Gamestatus.whishlist,
                    Rating = 0
                };
                await _unitOfWork.UserGames.Add(userGame);
                _unitOfWork.Save();
                return true;
            }

            if (userGame.IsInWishlist)
                return false;

            userGame.IsFavorite = !userGame.IsFavorite;
            var hasLibrary = userGame.Gamestatus != Gamestatus.whishlist;
            if (!userGame.IsFavorite && !hasLibrary && !userGame.IsInWishlist)
            {
                await _unitOfWork.UserGames.DeleteAsync(userGame);
                _unitOfWork.Save();
                return false;
            }

            await _unitOfWork.UserGames.Update(userGame);
            _unitOfWork.Save();
            return userGame.IsFavorite;
        }

        public async Task<bool> AddToLibraryAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await _unitOfWork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame != null)
            {
                var currentlyInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                if (!currentlyInLibrary && userGame.IsInWishlist)
                    return false;

                if (currentlyInLibrary)
                {
                    userGame.Gamestatus = Gamestatus.whishlist;
                    if (!userGame.IsFavorite && !userGame.IsInWishlist)
                        await _unitOfWork.UserGames.DeleteAsync(userGame);
                    else
                        await _unitOfWork.UserGames.Update(userGame);

                    _unitOfWork.Save();
                    return false;
                }

                userGame.Gamestatus = Gamestatus.Pending;
                userGame.AddedAt = DateTime.UtcNow;
                await _unitOfWork.UserGames.Update(userGame);
                _unitOfWork.Save();
                return true;
            }

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

            await _unitOfWork.UserGames.Add(userGame);
            _unitOfWork.Save();
            return true;
        }

        public async Task<bool> ToggleWishlistAsync(string userId, int externalId)
        {
            var game = await EnsureGameExistsAsync(externalId);
            if (game == null) return false;

            var userGame = await _unitOfWork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == game.Id);

            if (userGame != null)
            {
                var currentlyInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                if (!userGame.IsInWishlist && (currentlyInLibrary || userGame.IsFavorite))
                    return false;

                userGame.IsInWishlist = !userGame.IsInWishlist;

                if (!userGame.IsInWishlist)
                {
                    var hasLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                    if (!hasLibrary && !userGame.IsFavorite)
                    {
                        await _unitOfWork.UserGames.DeleteAsync(userGame);
                        _unitOfWork.Save();
                        return false;
                    }
                }

                await _unitOfWork.UserGames.Update(userGame);
                _unitOfWork.Save();
                return userGame.IsInWishlist;
            }

            userGame = new UserGame
            {
                UserId = userId,
                GameId = game.Id,
                IsFavorite = false,
                IsInWishlist = true,
                Gamestatus = Gamestatus.whishlist,
                Rating = 0
            };

            await _unitOfWork.UserGames.Add(userGame);
            _unitOfWork.Save();
            return true;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetSimilarGamesAsync(int externalId)
        {
            var source = await GetSteamAppDetailsAsync(externalId);
            if (source == null) return Enumerable.Empty<RAWGCatalogDto>();

            var seed = source.Value.genres.FirstOrDefault() ?? source.Value.name;
            var appIds = await SearchSteamAppIdsAsync(seed, 60);

            var games = await EnrichCatalogByIdsAsync(appIds.Where(x => x != externalId).Take(24).ToList());
            var ranked = games
                .OrderByDescending(g => SharedGenresScore(g.Genres, source.Value.genres))
                .ThenByDescending(g => g.Rating)
                .Take(6)
                .ToList();

            await PopulateUserStatesAsync(ranked);
            return ranked;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> GetCompanyGamesAsync(string companyName, int page = 1)
        {
            if (string.IsNullOrWhiteSpace(companyName)) return Enumerable.Empty<RAWGCatalogDto>();

            var normalized = companyName.Trim();
            const int pageSize = 6;
            var syncKey = $"company_sync:{normalized.ToLowerInvariant()}";

            // 1. One-time Sync from Steam to DB (if not done recently)
            if (!_cache.TryGetValue(syncKey, out _))
            {
                // A. Search Steam for IDs
                var steamIds = await SearchSteamAppIdsAsync(normalized, 100);

                // B. Broad search fallback (e.g. "Bethesda" if "Bethesda Game Studios" is thin)
                if (steamIds.Count < 5)
                {
                    var words = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (words.Length > 0 && words[0].Length > 3)
                    {
                        var broader = await SearchSteamAppIdsAsync(words[0], 50);
                        steamIds = steamIds.Concat(broader).Distinct().ToList();
                    }
                }

                // C. Hydration (Sequential to avoid DbContext concurrency issues)
                var existingIds = await _unitOfWork.Games.Query()
                    .Where(g => steamIds.Contains(g.ExternalId))
                    .Select(g => g.ExternalId)
                    .ToListAsync();

                var missingIds = steamIds.Except(existingIds).ToList();
                foreach (var appId in missingIds)
                {
                    await EnsureGameExistsAsync(appId);
                }

                // D. Mark as synced for a while
                _cache.Set(syncKey, true, TimeSpan.FromHours(24));
            }

            // 2. Query DB (The source of truth after sync)
            var dbGamesQuery = _unitOfWork.Games.Query()
                .Include(g => g.GameTags).ThenInclude(gt => gt.Tag)
                .Include(g => g.GamePlatforms).ThenInclude(gp => gp.Platform)
                .Where(g => g.GameDevelopers.Any(gd => gd.Developer.Name.ToLower() == normalized.ToLower()) ||
                            g.GamePublishers.Any(gp => gp.PublisherEntity.Name.ToLower() == normalized.ToLower()))
                .OrderByDescending(g => g.Rating ?? 0)
                .ThenByDescending(g => g.ReleaseDate ?? DateTime.MinValue);

            var totalInDb = await dbGamesQuery.CountAsync();
            var pagedDbGames = await dbGamesQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var results = pagedDbGames.Select(MapGameToCatalogDto).ToList();
            await PopulateUserStatesAsync(results);

            return results;
        }

        private async Task<Game?> EnsureGameExistsAsync(int externalId)
        {
            var game = await _unitOfWork.Games.Query()
                .Include(g => g.GameDevelopers)
                .Include(g => g.GamePublishers)
                .FirstOrDefaultAsync(g => g.ExternalId == externalId);

            if (game != null && game.IsDetailsHydrated) return game;

            var details = await GetSteamAppDetailsAsync(externalId);
            if (details == null) return null;

            game ??= new Game { ExternalId = externalId };
            await UpsertGameAggregateAsync(game, details.Value, game.Id == 0);
            
            return game;
        }

        private async Task<List<RAWGCatalogDto>> GetCatalogFromDatabaseAsync(int maxCount = 1500)
        {
            var games = await _unitOfWork.Games.Query()
                .Include(g => g.GameTags).ThenInclude(gt => gt.Tag)
                .Include(g => g.GamePlatforms).ThenInclude(gp => gp.Platform)
                .Where(g => g.ExternalId > 0)
                .OrderByDescending(g => g.Rating ?? 0)
                .ThenByDescending(g => g.Metacritic ?? 0)
                .ThenByDescending(g => g.ReleaseDate ?? DateTime.MinValue)
                .Take(maxCount)
                .ToListAsync();

            return games.Select(MapGameToCatalogDto).ToList();
        }

        private void InvalidateDefaultCatalogCachePages()
        {
            // Clear most commonly requested unfiltered pages.
            for (var page = 1; page <= 120; page++)
            {
                var key = $"steam:catalog:{CatalogFeedVersion}:{page}::::";
                _cache.Remove(key);
            }
        }

        private async Task<Game?> LoadGameAggregateAsync(int externalId)
        {
            return await _unitOfWork.Games.Query()
                .Include(g => g.GameTags).ThenInclude(gt => gt.Tag)
                .Include(g => g.GamePlatforms).ThenInclude(gp => gp.Platform)
                .Include(g => g.GameDevelopers).ThenInclude(gd => gd.Developer)
                .Include(g => g.GamePublishers).ThenInclude(gp => gp.PublisherEntity)
                .Include(g => g.Screenshots)
                .Include(g => g.Trailers)
                .FirstOrDefaultAsync(g => g.ExternalId == externalId);
        }

        private async Task UpsertGameAggregateAsync(Game game, (int appId, string name, string description, string headerImage, string backgroundImage, string releaseDate, int? metacritic, double rating, string website, List<string> genres, List<string> developers, List<string> publishers, List<string> platforms, string trailerUrl, string trailerPreview, List<string> screenshots, string minimumRequirements, string recommendedRequirements, decimal? price, int? achievementsCount) details, bool isNew)
        {
            game.Title = details.name;
            game.Description = details.description;
            game.ImgUrl = details.headerImage;
            game.BackgroundImageUrl = details.backgroundImage;
            game.PosterImageUrl = BuildSteamPosterImageUrl(details.appId);
            game.ReleaseDate = ParseDateSafe(details.releaseDate);
            game.Publisher = details.publishers.FirstOrDefault();
            game.Website = details.website;
            game.Metacritic = details.metacritic;
            game.Rating = details.rating;
            game.RatingTop = 5;
            game.RatingsCount = 0;
            game.Playtime = 0;
            game.MinimumRequirements = details.minimumRequirements;
            game.RecommendedRequirements = details.recommendedRequirements;
            game.Price = details.price;
            game.AchievementsCount = details.achievementsCount;
            game.TrailerUrl = details.trailerUrl;
            game.TrailerPreview = details.trailerPreview;
            game.IsDetailsHydrated = true;
            game.DetailsLastSyncedAt = DateTime.UtcNow;

            if (isNew)
                await _unitOfWork.Games.Add(game);
            else
                await _unitOfWork.Games.Update(game);

            _unitOfWork.Save();

            await ReplaceTagsAsync(game.Id, details.genres);
            await ReplacePlatformsAsync(game.Id, details.platforms);
            await ReplaceDevelopersAsync(game.Id, details.developers);
            await ReplacePublishersAsync(game.Id, details.publishers);
            await ReplaceScreenshotsAsync(game.Id, details.screenshots);
            await ReplaceTrailersAsync(game.Id, details.trailerUrl, details.trailerPreview);
        }

        private async Task ReplaceTagsAsync(int gameId, List<string> tags)
        {
            var existing = await _unitOfWork.GameTags.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GameTags.DeleteAsync(row);

            var cleanTags = tags.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            foreach (var name in cleanTags)
            {
                var tag = await _unitOfWork.Tags.Query().FirstOrDefaultAsync(x => x.Name == name);
                if (tag == null)
                {
                    tag = new Tag { Name = name, Slug = Slugify(name) };
                    await _unitOfWork.Tags.Add(tag);
                    _unitOfWork.Save();
                }

                await _unitOfWork.GameTags.Add(new GameTag { GameId = gameId, TagId = tag.Id });
            }

            _unitOfWork.Save();
        }

        private async Task ReplacePlatformsAsync(int gameId, List<string> platforms)
        {
            var existing = await _unitOfWork.GamePlatforms.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GamePlatforms.DeleteAsync(row);

            var cleanPlatforms = platforms.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            foreach (var name in cleanPlatforms)
            {
                var platform = await _unitOfWork.Platforms.Query().FirstOrDefaultAsync(x => x.Name == name);
                if (platform == null)
                {
                    platform = new Platform { Name = name, Slug = Slugify(name) };
                    await _unitOfWork.Platforms.Add(platform);
                    _unitOfWork.Save();
                }

                await _unitOfWork.GamePlatforms.Add(new GamePlatform { GameId = gameId, PlatformId = platform.Id });
            }

            _unitOfWork.Save();
        }

        private async Task ReplaceDevelopersAsync(int gameId, List<string> developers)
        {
            var existing = await _unitOfWork.GameDevelopers.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GameDevelopers.DeleteAsync(row);

            var cleanDevelopers = developers.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            foreach (var name in cleanDevelopers)
            {
                var developer = await _unitOfWork.Developers.Query().FirstOrDefaultAsync(x => x.Name == name);
                if (developer == null)
                {
                    developer = new Developer { Name = name };
                    await _unitOfWork.Developers.Add(developer);
                    _unitOfWork.Save();
                }

                await _unitOfWork.GameDevelopers.Add(new GameDeveloper { GameId = gameId, DeveloperId = developer.Id });
            }

            _unitOfWork.Save();
        }

        private async Task ReplacePublishersAsync(int gameId, List<string> publishers)
        {
            var existing = await _unitOfWork.GamePublishers.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GamePublishers.DeleteAsync(row);

            var cleanPublishers = publishers.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            foreach (var name in cleanPublishers)
            {
                var publisher = await _unitOfWork.PublisherEntities.Query().FirstOrDefaultAsync(x => x.Name == name);
                if (publisher == null)
                {
                    publisher = new PublisherEntity { Name = name };
                    await _unitOfWork.PublisherEntities.Add(publisher);
                    _unitOfWork.Save();
                }

                await _unitOfWork.GamePublishers.Add(new GamePublisher { GameId = gameId, PublisherEntityId = publisher.Id });
            }

            _unitOfWork.Save();
        }

        private async Task ReplaceScreenshotsAsync(int gameId, List<string> screenshots)
        {
            var existing = await _unitOfWork.GameScreenshots.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GameScreenshots.DeleteAsync(row);

            var cleanShots = screenshots.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
            for (var i = 0; i < cleanShots.Count; i++)
            {
                await _unitOfWork.GameScreenshots.Add(new GameScreenshot
                {
                    GameId = gameId,
                    ImageUrl = cleanShots[i],
                    DisplayOrder = i
                });
            }

            _unitOfWork.Save();
        }

        private async Task ReplaceTrailersAsync(int gameId, string trailerUrl, string trailerPreview)
        {
            var existing = await _unitOfWork.GameTrailers.Query().Where(x => x.GameId == gameId).ToListAsync();
            foreach (var row in existing) await _unitOfWork.GameTrailers.DeleteAsync(row);

            if (!string.IsNullOrWhiteSpace(trailerUrl))
            {
                await _unitOfWork.GameTrailers.Add(new GameTrailer
                {
                    GameId = gameId,
                    VideoUrl = trailerUrl,
                    PreviewImageUrl = trailerPreview
                });
            }

            _unitOfWork.Save();
        }

        private async Task PopulateUserStatesAsync(List<RAWGCatalogDto> games)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId) || games.Count == 0) return;

            var ids = games.Select(g => g.ExternalId).ToList();
            var userGames = await _unitOfWork.UserGames.Query()
                .Include(ug => ug.Game)
                .Where(ug => ug.UserId == userId && ids.Contains(ug.Game.ExternalId))
                .Select(ug => new { ug.Game.ExternalId, ug.IsFavorite, ug.Gamestatus, ug.IsInWishlist })
                .ToListAsync();

            foreach (var game in games)
            {
                var userGame = userGames.FirstOrDefault(ug => ug.ExternalId == game.ExternalId);
                if (userGame == null) continue;
                game.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
                game.IsInWishlist = userGame.IsInWishlist;
                game.IsFavorite = userGame.IsFavorite;
            }
        }

        private async Task PopulateDetailsUserStateAsync(RAWGGameDetailsDto dto, int gameId, string? userId)
        {
            if (string.IsNullOrWhiteSpace(userId)) return;

            var userGame = await _unitOfWork.UserGames.Query()
                .FirstOrDefaultAsync(ug => ug.UserId == userId && ug.GameId == gameId);

            if (userGame == null) return;

            dto.IsFavorite = userGame.IsFavorite;
            dto.IsInWishlist = userGame.IsInWishlist;
            dto.IsInLibrary = userGame.Gamestatus != Gamestatus.whishlist;
        }

        private static RAWGCatalogDto MapGameToCatalogDto(Game game)
        {
            return new RAWGCatalogDto
            {
                ExternalId = game.ExternalId,
                Title = game.Title,
                ImageUrl = game.ImgUrl ?? string.Empty,
                Rating = game.Rating ?? 0,
                Metacritic = game.Metacritic,
                ReleaseDate = game.ReleaseDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                Genres = game.GameTags.Select(x => x.Tag.Name).ToList(),
                Platforms = game.GamePlatforms.Select(x => x.Platform.Name).ToList()
            };
        }

        private static RAWGGameDetailsDto MapGameToDetailsDto(Game game)
        {
            var primaryTrailer = game.Trailers.OrderBy(x => x.Id).FirstOrDefault();

            return new RAWGGameDetailsDto
            {
                ExternalId = game.ExternalId,
                Title = game.Title,
                Description = game.Description ?? string.Empty,
                BackgroundImage = game.BackgroundImageUrl ?? game.ImgUrl ?? string.Empty,
                BackgroundImageAdditional = game.ImgUrl ?? string.Empty,
                PosterImage = game.PosterImageUrl ?? string.Empty,
                Rating = game.Rating ?? 0,
                RatingTop = game.RatingTop ?? 5,
                RatingsCount = game.RatingsCount ?? 0,
                ReleaseDate = game.ReleaseDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                Metacritic = game.Metacritic,
                Playtime = game.Playtime ?? 0,
                Website = game.Website ?? string.Empty,
                AchievementsCount = game.AchievementsCount,
                TrailerUrl = game.TrailerUrl ?? primaryTrailer?.VideoUrl ?? string.Empty,
                TrailerPreview = game.TrailerPreview ?? primaryTrailer?.PreviewImageUrl ?? string.Empty,
                Genres = game.GameTags.Select(x => x.Tag.Name).ToList(),
                Platforms = game.GamePlatforms.Select(x => x.Platform.Name).ToList(),
                Tags = game.GameTags.Select(x => x.Tag.Name).ToList(),
                Developers = game.GameDevelopers.Select(x => x.Developer.Name).ToList(),
                Publishers = game.GamePublishers.Select(x => x.PublisherEntity.Name).ToList(),
                EsrbRating = game.EsrbRating,
                Screenshots = game.Screenshots.OrderBy(x => x.DisplayOrder).Select(x => x.ImageUrl).ToList(),
                MinimumRequirements = game.MinimumRequirements,
                RecommendedRequirements = game.RecommendedRequirements,
                Price = game.Price
            };
        }

        private async Task<List<RAWGCatalogDto>> FetchFeaturedCatalogAsync()
        {
            var popularApps = await FetchSteamSpyPopularAppsAsync(1000);
            var popularIds = popularApps.Select(x => x.appId).ToList();

            var url = "https://store.steampowered.com/api/featuredcategories?cc=us&l=english";
            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return new List<RAWGCatalogDto>();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;

            var bag = new Dictionary<int, RAWGCatalogDto>();
            var popularity = new Dictionary<int, double>();

            var sectionWeights = new Dictionary<string, double>
            {
                ["top_sellers"] = 1000,
                ["featured_win"] = 700,
                ["new_releases"] = 500
            };

            foreach (var section in sectionWeights.Keys)
            {
                if (!root.TryGetProperty(section, out var sectionNode)) continue;
                if (!sectionNode.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array) continue;

                var index = 0;
                foreach (var item in items.EnumerateArray())
                {
                    if (!item.TryGetProperty("id", out var idNode) || idNode.ValueKind != JsonValueKind.Number) continue;
                    var id = idNode.GetInt32();
                    var popularityScore = sectionWeights[section] - (index * 5);
                    index++;

                    if (!popularity.ContainsKey(id) || popularity[id] < popularityScore)
                    {
                        popularity[id] = popularityScore;
                    }

                    var title = item.TryGetProperty("name", out var n) ? n.GetString() ?? string.Empty : string.Empty;
                    var image = item.TryGetProperty("large_capsule_image", out var i) ? i.GetString() ?? string.Empty : string.Empty;
                    var metascore = item.TryGetProperty("metascore", out var m) && m.ValueKind == JsonValueKind.Number ? m.GetInt32() : (int?)null;
                    var releaseDate = item.TryGetProperty("release_date", out var rd) ? rd.GetString() ?? string.Empty : string.Empty;

                    var platforms = new List<string>();
                    if (item.TryGetProperty("windows_available", out var w) && w.ValueKind == JsonValueKind.True) platforms.Add("PC");
                    if (item.TryGetProperty("mac_available", out var mac) && mac.ValueKind == JsonValueKind.True) platforms.Add("Mac");
                    if (item.TryGetProperty("linux_available", out var lin) && lin.ValueKind == JsonValueKind.True) platforms.Add("Linux");
                    if (!platforms.Any()) platforms.Add("PC");

                    if (bag.TryGetValue(id, out var existing))
                    {
                        if (existing.Metacritic == null && metascore != null) existing.Metacritic = metascore;
                        if (existing.Rating <= 0 && metascore != null) existing.Rating = Math.Round(metascore.Value / 20.0, 1);
                        if (string.IsNullOrWhiteSpace(existing.ImageUrl) && !string.IsNullOrWhiteSpace(image)) existing.ImageUrl = image;
                        continue;
                    }

                    bag[id] = new RAWGCatalogDto
                    {
                        ExternalId = id,
                        Title = title,
                        ImageUrl = image,
                        Metacritic = metascore,
                        Rating = metascore.HasValue ? Math.Round(metascore.Value / 20.0, 1) : 0,
                        ReleaseDate = releaseDate,
                        Genres = new List<string>(),
                        Platforms = platforms
                    };
                }
            }

            var featuredRanked = bag.Values
                .OrderByDescending(g => popularity.TryGetValue(g.ExternalId, out var p) ? p : 0)
                .ThenByDescending(g => g.Metacritic ?? -1)
                .ThenByDescending(g => g.Rating)
                .ThenByDescending(g => ParseDateSafe(g.ReleaseDate) ?? DateTime.MinValue)
                .ToList();

            if (popularIds.Count == 0)
            {
                return featuredRanked;
            }

            // Enrich only the top chunk to keep API latency reasonable while still enabling deep scrolling.
            var steamSpyPopular = await EnrichCatalogByIdsAsync(popularIds.Take(120).ToList());
            var popularityOrder = popularIds
                .Select((id, index) => new { id, index })
                .ToDictionary(x => x.id, x => x.index);

            // Keep released titles and quality items at the top to avoid noisy upcoming entries.
            steamSpyPopular = steamSpyPopular
                .Where(g => !string.IsNullOrWhiteSpace(g.ReleaseDate) || (g.Metacritic ?? 0) >= 70 || g.Rating >= 4)
                .ToList();

            var merged = new Dictionary<int, RAWGCatalogDto>();
            foreach (var game in steamSpyPopular)
            {
                merged[game.ExternalId] = game;
            }

            // Add lightweight entries for the rest of the 1k list so users can keep scrolling.
            foreach (var app in popularApps)
            {
                if (merged.ContainsKey(app.appId)) continue;

                merged[app.appId] = new RAWGCatalogDto
                {
                    ExternalId = app.appId,
                    Title = string.IsNullOrWhiteSpace(app.name) ? $"Steam App {app.appId}" : app.name,
                    ImageUrl = $"https://cdn.akamai.steamstatic.com/steam/apps/{app.appId}/header.jpg",
                    Rating = 0,
                    Metacritic = null,
                    ReleaseDate = string.Empty,
                    Genres = new List<string>(),
                    Platforms = new List<string> { "PC" }
                };
            }

            foreach (var game in featuredRanked)
            {
                if (!merged.ContainsKey(game.ExternalId))
                {
                    merged[game.ExternalId] = game;
                }
            }

            return merged.Values
                .OrderBy(g => popularityOrder.TryGetValue(g.ExternalId, out var idx) ? idx : int.MaxValue)
                .ThenByDescending(g => g.Metacritic ?? -1)
                .ThenByDescending(g => g.Rating)
                .ThenByDescending(g => ParseDateSafe(g.ReleaseDate) ?? DateTime.MinValue)
                .ToList();
        }

        private async Task<List<(int appId, string name, double score)>> FetchSteamSpyPopularAppsAsync(int targetCount)
        {
            try
            {
                using var response = await _http.GetAsync("https://steamspy.com/api.php?request=all");
                if (!response.IsSuccessStatusCode)
                {
                    return await FetchSteamSpyPopularAppsFallbackAsync(targetCount);
                }

                using var stream = await response.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);

                if (doc.RootElement.ValueKind != JsonValueKind.Object)
                {
                    return await FetchSteamSpyPopularAppsFallbackAsync(targetCount);
                }

                var ranked = new List<(int appId, string name, double score)>();

                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    var node = prop.Value;
                    if (node.ValueKind != JsonValueKind.Object) continue;

                    var appId = 0;
                    if (node.TryGetProperty("appid", out var appIdNode) && appIdNode.ValueKind == JsonValueKind.Number)
                    {
                        appId = appIdNode.GetInt32();
                    }
                    else if (!int.TryParse(prop.Name, out appId))
                    {
                        continue;
                    }

                    var name = node.TryGetProperty("name", out var n) ? (n.GetString() ?? string.Empty) : string.Empty;

                    var ownersText = node.TryGetProperty("owners", out var ownersNode) ? (ownersNode.GetString() ?? string.Empty) : string.Empty;
                    var ownersScore = ParseOwnersMidpoint(ownersText);

                    var positive = node.TryGetProperty("positive", out var pNode) && pNode.ValueKind == JsonValueKind.Number ? pNode.GetDouble() : 0;
                    var negative = node.TryGetProperty("negative", out var nNode) && nNode.ValueKind == JsonValueKind.Number ? nNode.GetDouble() : 0;
                    var ccu = node.TryGetProperty("ccu", out var cNode) && cNode.ValueKind == JsonValueKind.Number ? cNode.GetDouble() : 0;

                    var reviewTotal = positive + negative;
                    var reviewRatio = reviewTotal > 0 ? positive / reviewTotal : 0;

                    // Weighted popularity score that favors ownership + active players + positive review ratio.
                    var score = ownersScore + (ccu * 80) + (reviewRatio * 500000);

                    if (appId > 0)
                    {
                        ranked.Add((appId, name, score));
                    }
                }

                return ranked
                    .OrderByDescending(x => x.score)
                    .Take(targetCount)
                    .ToList();
            }
            catch
            {
                return await FetchSteamSpyPopularAppsFallbackAsync(targetCount);
            }
        }

        private async Task<List<(int appId, string name, double score)>> FetchSteamSpyPopularAppsFallbackAsync(int targetCount)
        {
            var ids = await FetchSteamSpyPopularAppIdsAsync();
            return ids
                .Take(targetCount)
                .Select((id, index) => (id, string.Empty, (double)(targetCount - index)))
                .ToList();
        }

        private static double ParseOwnersMidpoint(string ownersRange)
        {
            if (string.IsNullOrWhiteSpace(ownersRange)) return 0;

            var normalized = ownersRange.Replace(",", string.Empty).Trim();
            var parts = normalized.Split("..", StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length == 2 &&
                double.TryParse(parts[0], out var low) &&
                double.TryParse(parts[1], out var high))
            {
                return (low + high) / 2.0;
            }

            return double.TryParse(normalized, out var single) ? single : 0;
        }

        private async Task<List<int>> FetchSteamSpyPopularAppIdsAsync()
        {
            try
            {
                using var response = await _http.GetAsync("https://steamspy.com/api.php?request=top100in2weeks");
                if (!response.IsSuccessStatusCode) return new List<int>();

                using var stream = await response.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);

                if (doc.RootElement.ValueKind != JsonValueKind.Object)
                    return new List<int>();

                var ids = new List<int>();
                foreach (var item in doc.RootElement.EnumerateObject())
                {
                    if (item.Value.TryGetProperty("appid", out var appIdNode) && appIdNode.ValueKind == JsonValueKind.Number)
                    {
                        ids.Add(appIdNode.GetInt32());
                        continue;
                    }

                    if (int.TryParse(item.Name, out var parsedId))
                    {
                        ids.Add(parsedId);
                    }
                }

                return ids.Distinct().ToList();
            }
            catch
            {
                return new List<int>();
            }
        }

        private async Task<List<int>> SearchSteamAppIdsAsync(string query, int count)
        {
            var url = $"https://store.steampowered.com/api/storesearch/?term={Uri.EscapeDataString(query)}&l=english&cc=us&start=0&count={count}";
            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return new List<int>();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            if (!doc.RootElement.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
                return new List<int>();

            return items.EnumerateArray()
                .Where(x => x.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.Number)
                .Select(x => x.GetProperty("id").GetInt32())
                .Distinct()
                .Take(count)
                .ToList();
        }

        private async Task<List<RAWGCatalogDto>> EnrichCatalogByIdsAsync(List<int> ids)
        {
            var list = new List<RAWGCatalogDto>();
            var dedup = ids.Distinct().ToList();

            foreach (var appId in dedup)
            {
                var details = await GetSteamAppDetailsAsync(appId);
                if (details == null) continue;

                list.Add(new RAWGCatalogDto
                {
                    ExternalId = details.Value.appId,
                    Title = details.Value.name,
                    ImageUrl = details.Value.headerImage,
                    Rating = details.Value.rating,
                    Metacritic = details.Value.metacritic,
                    ReleaseDate = details.Value.releaseDate,
                    Genres = details.Value.genres,
                    Platforms = details.Value.platforms
                });
            }

            return list;
        }

        private async Task<(int appId, string name, string description, string headerImage, string backgroundImage, string releaseDate, int? metacritic, double rating, string website, List<string> genres, List<string> developers, List<string> publishers, List<string> platforms, string trailerUrl, string trailerPreview, List<string> screenshots, string minimumRequirements, string recommendedRequirements, decimal? price, int? achievementsCount)?> GetSteamAppDetailsAsync(int appId, bool forceRefresh = false)
        {
            var cacheKey = $"steam:appdetails:{appId}";
            if (!forceRefresh && _cache.TryGetValue(cacheKey, out (int appId, string name, string description, string headerImage, string backgroundImage, string releaseDate, int? metacritic, double rating, string website, List<string> genres, List<string> developers, List<string> publishers, List<string> platforms, string trailerUrl, string trailerPreview, List<string> screenshots, string minimumRequirements, string recommendedRequirements, decimal? price, int? achievementsCount) cached))
            {
                return cached;
            }

            var url = $"https://store.steampowered.com/api/appdetails?appids={appId}&l=english&cc=us";
            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            var appKey = appId.ToString();
            if (!doc.RootElement.TryGetProperty(appKey, out var wrapper)) return null;
            if (!wrapper.TryGetProperty("success", out var successNode) || successNode.ValueKind != JsonValueKind.True) return null;
            if (!wrapper.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return null;

            var name = data.TryGetProperty("name", out var n) ? n.GetString() ?? string.Empty : string.Empty;
            var shortDescription = data.TryGetProperty("short_description", out var sdesc) ? sdesc.GetString() ?? string.Empty : string.Empty;
            var detailedDescription = data.TryGetProperty("detailed_description", out var ddesc) ? ddesc.GetString() ?? string.Empty : string.Empty;
            var description = SanitizeHtmlToText(!string.IsNullOrWhiteSpace(detailedDescription) ? detailedDescription : shortDescription);

            var headerImage = data.TryGetProperty("header_image", out var hi) ? hi.GetString() ?? string.Empty : string.Empty;
            var backgroundImage = data.TryGetProperty("background_raw", out var bgRaw) ? bgRaw.GetString() ?? string.Empty : (data.TryGetProperty("background", out var bg) ? bg.GetString() ?? string.Empty : headerImage);

            string releaseDate = string.Empty;
            if (data.TryGetProperty("release_date", out var relObj) && relObj.ValueKind == JsonValueKind.Object)
            {
                releaseDate = relObj.TryGetProperty("date", out var relDate) ? relDate.GetString() ?? string.Empty : string.Empty;
            }

            int? metacritic = null;
            if (data.TryGetProperty("metacritic", out var mcObj) && mcObj.ValueKind == JsonValueKind.Object)
            {
                if (mcObj.TryGetProperty("score", out var scoreNode) && scoreNode.ValueKind == JsonValueKind.Number)
                    metacritic = scoreNode.GetInt32();
            }

            var website = data.TryGetProperty("website", out var websiteNode) ? websiteNode.GetString() ?? string.Empty : string.Empty;

            var genres = new List<string>();
            if (data.TryGetProperty("genres", out var genresNode) && genresNode.ValueKind == JsonValueKind.Array)
            {
                foreach (var g in genresNode.EnumerateArray())
                {
                    if (g.TryGetProperty("description", out var gd))
                    {
                        var value = gd.GetString();
                        if (!string.IsNullOrWhiteSpace(value)) genres.Add(value);
                    }
                }
            }

            var developers = ParseStringArrayProperty(data, "developers");
            var publishers = ParseStringArrayProperty(data, "publishers");

            var platforms = new List<string>();
            if (data.TryGetProperty("platforms", out var p) && p.ValueKind == JsonValueKind.Object)
            {
                if (p.TryGetProperty("windows", out var w) && w.ValueKind == JsonValueKind.True) platforms.Add("PC");
                if (p.TryGetProperty("mac", out var mac) && mac.ValueKind == JsonValueKind.True) platforms.Add("Mac");
                if (p.TryGetProperty("linux", out var lin) && lin.ValueKind == JsonValueKind.True) platforms.Add("Linux");
            }
            if (!platforms.Any()) platforms.Add("PC");

            string trailerUrl = string.Empty;
            string trailerPreview = string.Empty;
            if (data.TryGetProperty("movies", out var movies) && movies.ValueKind == JsonValueKind.Array)
            {
                var first = movies.EnumerateArray().FirstOrDefault();
                if (first.ValueKind == JsonValueKind.Object)
                {
                    if (first.TryGetProperty("mp4", out var mp4) && mp4.ValueKind == JsonValueKind.Object)
                    {
                        if (mp4.TryGetProperty("480", out var p480)) trailerUrl = p480.GetString() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(trailerUrl) && mp4.TryGetProperty("max", out var pMax)) trailerUrl = pMax.GetString() ?? string.Empty;
                    }

                    // Fallback to WebM if MP4 is missing
                    if (string.IsNullOrWhiteSpace(trailerUrl) && first.TryGetProperty("webm", out var webm) && webm.ValueKind == JsonValueKind.Object)
                    {
                        if (webm.TryGetProperty("480", out var w480)) trailerUrl = w480.GetString() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(trailerUrl) && webm.TryGetProperty("max", out var wMax)) trailerUrl = wMax.GetString() ?? string.Empty;
                    }

                    // Fallback to HLS (Streaming Format - very common now)
                    if (string.IsNullOrWhiteSpace(trailerUrl) && first.TryGetProperty("hls_h264", out var hls))
                    {
                        trailerUrl = hls.GetString() ?? string.Empty;
                    }

                    // Fallback to DASH (Streaming Format)
                    if (string.IsNullOrWhiteSpace(trailerUrl) && first.TryGetProperty("dash_h264", out var dash))
                    {
                        trailerUrl = dash.GetString() ?? string.Empty;
                    }
                    if (first.TryGetProperty("thumbnail", out var thumb)) trailerPreview = thumb.GetString() ?? string.Empty;
                }
            }

            var screenshots = new List<string>();
            if (data.TryGetProperty("screenshots", out var ss) && ss.ValueKind == JsonValueKind.Array)
            {
                screenshots = ss.EnumerateArray()
                    .Where(x => x.TryGetProperty("path_full", out _))
                    .Select(x => x.GetProperty("path_full").GetString() ?? string.Empty)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Take(12)
                    .ToList();
            }

            string minimumRequirements = string.Empty;
            string recommendedRequirements = string.Empty;
            if (data.TryGetProperty("pc_requirements", out var req) && req.ValueKind == JsonValueKind.Object)
            {
                if (req.TryGetProperty("minimum", out var minReq)) minimumRequirements = SanitizeHtmlToText(minReq.GetString() ?? string.Empty);
                if (req.TryGetProperty("recommended", out var recReq)) recommendedRequirements = SanitizeHtmlToText(recReq.GetString() ?? string.Empty);
            }

            var rating = metacritic.HasValue ? Math.Round(metacritic.Value / 20.0, 1) : 0;

            decimal? price = null;
            if (data.TryGetProperty("is_free", out var isFreeNode) && isFreeNode.ValueKind == JsonValueKind.True)
            {
                price = 0m;
            }
            else if (data.TryGetProperty("price_overview", out var priceObj) && priceObj.ValueKind == JsonValueKind.Object)
            {
                if (priceObj.TryGetProperty("final", out var finalNode) && finalNode.ValueKind == JsonValueKind.Number)
                {
                    price = Math.Round(finalNode.GetDecimal() / 100m, 2);
                }
            }

            int? achievementsCount = null;
            if (data.TryGetProperty("achievements", out var achObj) && achObj.ValueKind == JsonValueKind.Object)
            {
                if (achObj.TryGetProperty("total", out var totalNode) && totalNode.ValueKind == JsonValueKind.Number)
                    achievementsCount = totalNode.GetInt32();
            }

            var result = (appId, name, description, headerImage, backgroundImage, releaseDate, metacritic, rating, website, genres, developers, publishers, platforms, trailerUrl, trailerPreview, screenshots, minimumRequirements, recommendedRequirements, price, achievementsCount);
            _cache.Set(cacheKey, result, AppDetailsCacheTtl);
            return result;
        }

        private static RAWGCatalogDto CloneCatalogDto(RAWGCatalogDto source)
        {
            return new RAWGCatalogDto
            {
                ExternalId = source.ExternalId,
                Title = source.Title,
                ImageUrl = source.ImageUrl,
                Rating = source.Rating,
                Metacritic = source.Metacritic,
                ReleaseDate = source.ReleaseDate,
                Genres = source.Genres?.ToList() ?? new List<string>(),
                Platforms = source.Platforms?.ToList() ?? new List<string>(),
                IsFavorite = source.IsFavorite,
                IsInLibrary = source.IsInLibrary,
                IsInWishlist = source.IsInWishlist
            };
        }

        private static bool ShouldRefresh(Game game)
        {
            if (!game.DetailsLastSyncedAt.HasValue) return true;
            return DateTime.UtcNow - game.DetailsLastSyncedAt.Value > StaleThreshold;
        }

        private static List<RAWGCatalogDto> ApplyOrdering(List<RAWGCatalogDto> games, string? ordering)
        {
            return ordering switch
            {
                "-rating" => games.OrderByDescending(g => g.Rating).ToList(),
                "rating" => games.OrderBy(g => g.Rating).ToList(),
                "released" => games.OrderBy(g => ParseDateSafe(g.ReleaseDate) ?? DateTime.MaxValue).ToList(),
                "-released" => games.OrderByDescending(g => ParseDateSafe(g.ReleaseDate) ?? DateTime.MinValue).ToList(),
                _ => games
            };
        }

        private static bool MatchesPlatformFilter(RAWGCatalogDto game, string platformId)
        {
            return platformId switch
            {
                "1" => game.Platforms.Any(p => p.Contains("PC", StringComparison.OrdinalIgnoreCase) || p.Contains("Windows", StringComparison.OrdinalIgnoreCase)),
                "2" => game.Platforms.Any(p => p.Contains("Mac", StringComparison.OrdinalIgnoreCase)),
                "3" => game.Platforms.Any(p => p.Contains("Linux", StringComparison.OrdinalIgnoreCase)),
                _ => true
            };
        }

        private static (DateTime from, DateTime to)? ParseDateRange(string range)
        {
            var parts = range.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2) return null;
            if (!DateTime.TryParse(parts[0], out var from)) return null;
            if (!DateTime.TryParse(parts[1], out var to)) return null;
            return (from.Date, to.Date);
        }

        private static bool DateFallsInRange(string? date, DateTime from, DateTime to)
        {
            var parsed = ParseDateSafe(date);
            if (!parsed.HasValue) return false;
            return parsed.Value.Date >= from && parsed.Value.Date <= to;
        }

        private static DateTime? ParseDateSafe(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            return DateTime.TryParse(value, out var date) ? date : null;
        }

        private static string BuildSteamPosterImageUrl(int appId)
        {
            return $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_600x900_2x.jpg";
        }

        private static string Normalize(string value)
        {
            return value.Trim().ToLowerInvariant().Replace("-", " ");
        }

        private static string Slugify(string value)
        {
            return Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        }

        private static int SimilarityScore(string title, string query)
        {
            if (string.Equals(title, query, StringComparison.OrdinalIgnoreCase)) return 100;
            if (title.Contains(query, StringComparison.OrdinalIgnoreCase)) return 80;

            var qt = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var score = 0;
            foreach (var token in qt)
            {
                if (title.Contains(token, StringComparison.OrdinalIgnoreCase)) score += 10;
            }
            return score;
        }

        private static int SharedGenresScore(List<string> a, List<string> b)
        {
            if (a == null || b == null || a.Count == 0 || b.Count == 0) return 0;
            var setA = a.Select(Normalize).ToHashSet();
            var setB = b.Select(Normalize).ToHashSet();
            return setA.Intersect(setB).Count();
        }

        private static List<string> ParseStringArrayProperty(JsonElement data, string propertyName)
        {
            if (!data.TryGetProperty(propertyName, out var arr) || arr.ValueKind != JsonValueKind.Array)
                return new List<string>();

            return arr.EnumerateArray()
                .Where(x => x.ValueKind == JsonValueKind.String)
                .Select(x => x.GetString() ?? string.Empty)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();
        }

        private static string SanitizeHtmlToText(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var decoded = WebUtility.HtmlDecode(value);
            var noTags = Regex.Replace(decoded, "<.*?>", string.Empty);
            return Regex.Replace(noTags, "\\s+", " ").Trim();
        }
    }
}
