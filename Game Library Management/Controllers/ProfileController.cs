using Game_Library_Management_BL.DTO_s.ProfileDto;
using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService profileService;

        public ProfileController(IProfileService profileService)
        {
            this.profileService = profileService;
        }

        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var profile = await profileService.GetProfileAsync(userId);
            if (profile == null)
                return NotFound();

            return Ok(profile);
        }

        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromForm] ProfileUpdateDto model, [FromForm(Name = "Avatar")] IFormFile? avatarFile)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var updatedProfile = await profileService.UpdateProfileAsync(userId, model, avatarFile);
            if (updatedProfile == null)
                return BadRequest("Could not update profile");

            return Ok(updatedProfile);
        }
    }
}
