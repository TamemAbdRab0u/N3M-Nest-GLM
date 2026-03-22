using Game_Library_Management_BL.DTO_s.GameCatalogDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IGameCatalogService
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
    }
}
