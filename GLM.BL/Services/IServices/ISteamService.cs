using Game_Library_Management_BL.DTO_s.RAWGDto;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface ISteamService
    {
        Task<IEnumerable<RAWGCatalogDto>> GetAllGamesAsync(int page = 1, string? genre = null, string? platforms = null, string? ordering = null, string? dates = null);
        Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query);
        Task<IEnumerable<string>> GetAllGenresAsync();
        Task<IEnumerable<string>> GetAllPlatformsAsync();
        Task<IEnumerable<RAWGCatalogDto>> GetGamesByExternalIdsAsync(List<int> externalIds);
        Task<RAWGGameDetailsDto> GetGameDetailsAsync(int externalId);
        Task<bool> ImportGamesAsync(IEnumerable<RAWGCatalogDto> games);
        Task<bool> ToggleFavoriteAsync(string userId, int externalId);
        Task<bool> AddToLibraryAsync(string userId, int externalId);
        Task<bool> ToggleWishlistAsync(string userId, int externalId);
        Task<IEnumerable<RAWGCatalogDto>> GetSimilarGamesAsync(int externalId);
        Task<IEnumerable<RAWGCatalogDto>> GetCompanyGamesAsync(string companyName, int page = 1);
        Task<(int Requested, int Stored, int Updated, int Failed)> PreloadPopularGamesAsync(int take = 1000, int hydrateTop = 200, int skip = 0);
        Task<(int Total, int Updated, int Skipped, int Failed, List<(int ExternalId, string TrailerUrl)> Results)>
            SyncAchievementsAndTrailersAsync(bool overwriteExisting = false, CancellationToken cancellationToken = default);
    }
}
