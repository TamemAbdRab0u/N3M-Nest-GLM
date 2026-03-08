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
            var user = await unitOfWork.Users.Query().FirstOrDefaultAsync(x => x.Id == userId);

            if (profile == null)
            {
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

            // Prefer user.ImageUrl as the authoritative avatar source
            var imageUrl = user?.ImageUrl;
            var avatarUrl = imageUrl ?? profile.AvatarUrl;

            return new ProfileResponseDto
            {
                DisplayName = profile.DisplayName,
                Bio = profile.Bio,
                Email = profile.Email,
                AvatarUrl = avatarUrl,
                CoverUrl = profile.CoverUrl
            };
        }

        public async Task<ProfileResponseDto> GetPublicProfileAsync(string username)
        {
            // Look up user by Username (display name kept in sync)
            var user = await unitOfWork.Users.Query().FirstOrDefaultAsync(x => x.Username == username);
            if (user == null) return null;

            var profile = await unitOfWork.Profiles.Query().FirstOrDefaultAsync(p => p.UserId == user.Id);

            var avatarUrl = user.ImageUrl ?? profile?.AvatarUrl;

            return new ProfileResponseDto
            {
                DisplayName = profile?.DisplayName ?? user.Username,
                Bio = profile?.Bio,
                AvatarUrl = avatarUrl,
                CoverUrl = profile?.CoverUrl
                // Email intentionally omitted for public view
            };
        }

        public async Task<ProfileResponseDto> UpdateProfileAsync(string userId, ProfileUpdateDto model)
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

            
            profile.Bio = string.IsNullOrWhiteSpace(model.Bio) ? "..." : model.Bio;

            if (model.AvatarUrl != null && model.AvatarUrl.Length > 0)
            {
                var originalAvatar = profile.AvatarUrl;

                var fileName = await uploadHandler.UploadAsync(model.AvatarUrl);
                if (!fileName.StartsWith("Invalid") && !fileName.Contains("limit"))
                {
                    profile.AvatarUrl = fileName;

                    
                    if (appUser != null)
                        appUser.ImageUrl = fileName;

                    
                    if (!string.IsNullOrEmpty(originalAvatar))
                    {
                        try
                        {
                            var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", originalAvatar);
                            if (System.IO.File.Exists(oldPath))
                            {
                                System.IO.File.Delete(oldPath);
                            }
                        }
                        catch { }
                    }
                }
            }

            if (model.CoverUrl != null && model.CoverUrl.Length > 0)
            {
                var originalCover = profile.CoverUrl;

                var coverFileName = await uploadHandler.UploadAsync(model.CoverUrl);
                if (!coverFileName.StartsWith("Invalid") && !coverFileName.Contains("limit"))
                {
                    profile.CoverUrl = coverFileName;

                    if (!string.IsNullOrEmpty(originalCover))
                    {
                        try
                        {
                            var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", originalCover);
                            if (System.IO.File.Exists(oldPath))
                            {
                                System.IO.File.Delete(oldPath);
                            }
                        }
                        catch { }
                    }
                }
            }

            
            unitOfWork.Save();

            
            var updatedImageUrl = appUser?.ImageUrl ?? profile.AvatarUrl;

            return new ProfileResponseDto
            {
                DisplayName = profile.DisplayName,
                Bio = profile.Bio,
                Email = profile.Email,
                AvatarUrl = updatedImageUrl,
                CoverUrl = profile.CoverUrl
            };
        }
    }
}
