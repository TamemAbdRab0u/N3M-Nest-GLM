using Game_Library_Management_BL.DTO_s.ProfileDto;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IProfileService
    {
        Task<ProfileResponseDto> GetProfileAsync(string userId);
        Task<ProfileResponseDto> UpdateProfileAsync(string userId, ProfileUpdateDto model, IFormFile avatarFile);
    }
}
