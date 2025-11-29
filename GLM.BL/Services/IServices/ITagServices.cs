using Game_Library_Management_BL.DTO_s.TagsDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface ITagServices
    {
        Task<IEnumerable<TagResponseDto>> AllTagsAsync();
        Task<TagResponseDto> TagByIdAsync(int Id);
        Task<TagResponseDto> CreateTagAsync(TagCreateDto tag);
        Task<TagResponseDto> PatchTagAsync(int Id, TagUpdateDto tag);
        Task<bool> RemoveTagAsync(int Id);
    }
}
