using Game_Library_Management_BL.DTO_s.TagsDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class TagServices : ITagServices
    {
        private readonly IUnitOfWork unitofwork;
        public TagServices(IUnitOfWork unitofwork)
        {
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<TagResponseDto>> AllTagsAsync()
        {
            var Tags = await unitofwork.Tags.Query().ToListAsync();
            if(Tags == null || Tags.Count == 0)
            {
                return null;
            }

            return Tags.Select(x => new TagResponseDto
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description
            });
        }

        public async Task<TagResponseDto> TagByIdAsync(int Id)
        {
            var tag = await unitofwork.Tags.Query().FirstOrDefaultAsync(x => x.Id == Id);
            if(tag == null)
            {
                return null;
            }

            return new TagResponseDto
            {
                Id = tag.Id,
                Name = tag.Name,
                Description = tag.Description
            };
        }

        public async Task<TagResponseDto> CreateTagAsync(TagCreateDto tag)
        {
            var Tag = new Tag
            {
                Name = tag.Name,
                Description = tag.Description
            };

            await unitofwork.Tags.Add(Tag);
            unitofwork.Save();

            return new TagResponseDto
            {
                Id = Tag.Id,
                Name = Tag.Name,
                Description = Tag.Description
            };
        }

        public async Task<TagResponseDto> PatchTagAsync(int Id, TagUpdateDto tag)
        {
            var ExistingTag = await unitofwork.Tags.Query().FirstOrDefaultAsync(x => x.Id == Id);
            if(tag == null)
            {
                return null;
            }

            UpdateTagProperties(ExistingTag, tag);

            await unitofwork.Tags.Update(ExistingTag);
            unitofwork.Save();

            return new TagResponseDto
            {
                Id = ExistingTag.Id,
                Name = ExistingTag.Name,
                Description = ExistingTag.Description
            };
        }

        public async Task<bool> RemoveTagAsync(int Id)
        {
            var Tag = await unitofwork.Tags.Query().FirstOrDefaultAsync(x => x.Id == Id);
            if(Tag == null)
            {
                return false;
            }

            await unitofwork.Tags.Delete(Id);
            unitofwork.Save();

            return true;
        }

        // Helper method to update tag properties Partially
        private void UpdateTagProperties(Tag tag, TagUpdateDto tagDto)
        {
            if (!string.IsNullOrWhiteSpace(tagDto.Name))
            {
                tag.Name = tagDto.Name;
            }

            if(!string.IsNullOrWhiteSpace(tagDto.Description))
            {
                tag.Description = tagDto.Description;
            }
        }
    }
}
