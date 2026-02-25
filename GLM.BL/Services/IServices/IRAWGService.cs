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
        Task<IEnumerable<RAWGCatalogDto>> GetAllGamesAsync(int page = 1);
        Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query);
        Task<bool> ImportGamesAsync(IEnumerable<RAWGCatalogDto> games);
    }
}
