using Game_Library_Management_BL.DTO_s.PlatformsDto;
using Game_Library_Management_BL.DTO_s.TagsDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_PL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class PlatformServices : IPlatformservices
    {
        private readonly IUnitOfWork unitofwork;
        public PlatformServices(IUnitOfWork unitofwork)
        {
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<PlatformResponseDto>> AllPlatformsAsync()
        {
            var Platforms = await unitofwork.Platforms.Query().ToListAsync();
            if(Platforms == null || Platforms.Count == 0)
                return null;

            return Platforms.Select(x => new PlatformResponseDto
            {
                Id = x.Id,
                Name = x.Name,
            });
        }

        public async Task<PlatformResponseDto> PlatformByIdAsync(int Id)
        {
            var platform = await unitofwork.Platforms.Query().FirstOrDefaultAsync(x => x.Id == Id);
            if(platform == null)
            {
                return null;
            }

            return new PlatformResponseDto
            {
                Id = platform.Id,
                Name = platform.Name,
            };
        }

        public async Task<PlatformResponseDto> CreatePlatformAsync(PlatformCreateDto platform)
        {
            var CreatedPlatform = new Platform
            {
                Name = platform.Name
            };

            await unitofwork.Platforms.Add(CreatedPlatform);
            unitofwork.Save();

            return new PlatformResponseDto
            {
                Id = CreatedPlatform.Id,
                Name = CreatedPlatform.Name
            };
        }  

        public async Task<bool> RemovePlatformAsync(int Id)
        {
            var platform = await unitofwork.Platforms.Query().FirstOrDefaultAsync(x => x.Id == Id);
            if(platform == null)
                return false;
            
            await unitofwork.Platforms.Delete(Id);
            unitofwork.Save();

            return true;
        }
    }
}
