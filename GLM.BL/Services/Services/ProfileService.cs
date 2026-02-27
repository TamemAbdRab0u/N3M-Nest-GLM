using Game_Library_Management_BL.DTO_s.ProfileDto;
using Game_Library_Management_BL.Helper;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class ProfileService : IProfileService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly UploadHandler uploadHandler;
        private readonly UserManager<ApplicationUser> userManager;

        public ProfileService(IUnitOfWork unitOfWork, UploadHandler uploadHandler, UserManager<ApplicationUser> userManager)
        {
            this.unitOfWork = unitOfWork;
            this.uploadHandler = uploadHandler;
            this.userManager = userManager;
        }

        public async Task<ProfileResponseDto> GetProfileAsync(string userId)
        {
            var profile = await unitOfWork.Profiles.Query().FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                // If profile doesn't exist, create one for the user?
                var user = await unitOfWork.Users.Query().FirstOrDefaultAsync(x => x.Id == userId);
                if (user == null) return null;

                profile = new Profile
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = userId,
                    DisplayName = user.Username,
                    Email = user.Email
                };
                await unitOfWork.Profiles.Add(profile);
                unitOfWork.Save();
            }

            return new ProfileResponseDto
            {
                DisplayName = profile.DisplayName,
                Bio = profile.Bio,
                Email = profile.Email,
                AvatarUrl = profile.AvatarUrl,
                CoverUrl = profile.CoverUrl
            };
        }

        public async Task<ProfileResponseDto> UpdateProfileAsync(string userId, ProfileUpdateDto model, IFormFile avatarFile)
        {
            var profile = await unitOfWork.Profiles.Query().FirstOrDefaultAsync(p => p.UserId == userId);
            var appUser = await unitOfWork.Users.Query().FirstOrDefaultAsync(x => x.Id == userId);
            var identityUser = await userManager.FindByIdAsync(userId);

            if (profile == null)
            {
                profile = new Profile { 
                    Id = Guid.NewGuid().ToString(),
                    UserId = userId,
                    Email = appUser?.Email ?? identityUser?.Email
                };
                await unitOfWork.Profiles.Add(profile);
            }

            if (!string.IsNullOrEmpty(model.DisplayName))
            {
                profile.DisplayName = model.DisplayName;
                
                // If the user wants to sync this with Identity Username or custom User table Username:
                if (appUser != null)
                {
                    appUser.Username = model.DisplayName;
                }
                if (identityUser != null)
                {
                    var setUsernameResult = await userManager.SetUserNameAsync(identityUser, model.DisplayName);
                    if (setUsernameResult.Succeeded)
                    {
                        await userManager.UpdateAsync(identityUser);
                    }
                }
            }

            if (!string.IsNullOrEmpty(model.Bio))
            {
                profile.Bio = model.Bio;
            }

            if (avatarFile != null)
            {
                var fileName = await uploadHandler.UploadAsync(avatarFile);
                if (!fileName.StartsWith("Invalid") && !fileName.Contains("limit"))
                {
                    profile.AvatarUrl = fileName;
                }
            }

            unitOfWork.Save();

            return new ProfileResponseDto
            {
                DisplayName = profile.DisplayName,
                Bio = profile.Bio,
                Email = profile.Email,
                AvatarUrl = profile.AvatarUrl,
                CoverUrl = profile.CoverUrl
            };
        }
    }
}
