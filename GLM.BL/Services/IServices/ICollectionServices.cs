using Game_Library_Management_BL.DTO_s.CollectionsDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface ICollectionServices
    {
        Task<IEnumerable<CollectionResponseDto>> GetUserCollectionsAsync(string userId);
        Task<IEnumerable<CollectionResponseDto>> GetCollectionsByUsernameAsync(string username);
        Task<CollectionResponseDto> CreateCollectionAsync(string userId, CollectionCreateDto dto);
        Task<bool> DeleteCollectionAsync(int id, string userId);
        Task<bool> UpdateCollectionAsync(int id, string userId, CollectionCreateDto dto);
        Task<bool> AddGameToCollectionAsync(int collectionId, int gameId, string userId);
        Task<bool> RemoveGameFromCollectionAsync(int collectionId, int gameId, string userId);
        Task<IEnumerable<int>> GetGameCollectionIdsAsync(int gameId, string userId);
    }
}
