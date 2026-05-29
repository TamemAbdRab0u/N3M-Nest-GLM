using Game_Library_Management_BL.DTO_s.GameCatalogDto;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface ISteamService
    {
        Task<IEnumerable<CatalogGameSummaryDto>> GetAllGamesAsync(int page = 1, string? genre = null, string? platforms = null, string? ordering = null, string? dates = null);
        Task<IEnumerable<CatalogGameSummaryDto>> SearchGamesAsync(string query);
        Task<IEnumerable<string>> GetAllGenresAsync();
        Task<IEnumerable<string>> GetAllPlatformsAsync();
        Task<IEnumerable<CatalogGameSummaryDto>> GetGamesByExternalIdsAsync(List<int> externalIds);
        Task<CatalogGameDetailsDto> GetGameDetailsAsync(int externalId);
        Task<bool> ImportGamesAsync(IEnumerable<CatalogGameSummaryDto> games);
        Task<bool> ToggleFavoriteAsync(string userId, int externalId);
        Task<bool> AddToLibraryAsync(string userId, int externalId);
        Task<bool> ToggleWishlistAsync(string userId, int externalId);
        Task<IEnumerable<CatalogGameSummaryDto>> GetSimilarGamesAsync(int externalId);
        Task<IEnumerable<CatalogGameSummaryDto>> GetCompanyGamesAsync(string companyName, int page = 1);
        Task<(int Requested, int Stored, int Updated, int Failed)> PreloadPopularGamesAsync(int take = 1000, int hydrateTop = 200, int skip = 0);
        Task<(int Total, int Updated, int Skipped, int Failed, List<(int ExternalId, string TrailerUrl)> Results)>
            SyncAchievementsAndTrailersAsync(bool overwriteExisting = false, CancellationToken cancellationToken = default);
        
        Task<Game_Library_Management_BL.DTO_s.StoreHomeDto.StoreHomeDto> GetStoreHomeAsync();
    }
}
