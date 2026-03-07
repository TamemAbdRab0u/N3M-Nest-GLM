using Game_Library_Management_BL.DTO_s.RAWGDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IRAWGService
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
    }
}
