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

        [HttpGet("{username}")]
        public async Task<IActionResult> GetPublicProfile([FromRoute] string username)
        {
            var profile = await profileService.GetPublicProfileAsync(username);
            if (profile == null)
                return NotFound();

            return Ok(profile);
        }

        [HttpPut]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateProfile([FromForm] ProfileUpdateDto model)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var updatedProfile = await profileService.UpdateProfileAsync(userId, model);
            if (updatedProfile == null)
                return BadRequest("Could not update profile");

            return Ok(updatedProfile);
        }
    }
}
