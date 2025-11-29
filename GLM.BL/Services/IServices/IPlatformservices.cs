using Game_Library_Management_BL.DTO_s.PlatformsDto;
using Game_Library_Management_BL.DTO_s.TagsDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IPlatformservices
    {
        Task<IEnumerable<PlatformResponseDto>> AllPlatformsAsync();
        Task<PlatformResponseDto> PlatformByIdAsync(int Id);
        Task<PlatformResponseDto> CreatePlatformAsync(PlatformCreateDto platform);
        Task<bool> RemovePlatformAsync(int Id);
    }
}
