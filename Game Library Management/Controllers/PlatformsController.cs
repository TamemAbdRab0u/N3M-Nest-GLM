using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PlatformsController : ControllerBase
    {
        private readonly IPlatformservices platformservices;
        public PlatformsController(IPlatformservices platformservices)
        {
            this.platformservices = platformservices;
        }


        /// <summary>
        /// Return All Platforms.
        /// </summary>
        [HttpGet("GetAllPlatforms")]
        public async Task<IActionResult> GetAllPlatforms()
        {
            var platforms = await platformservices.AllPlatformsAsync();
            if (platforms == null)
                return NotFound("There Is No Platforms Yet");

            return Ok(platforms.Select(x => new {x.Name}));
        }

        /// <summary>
        /// Return Single Platform.
        /// </summary>
        /// <param name="Id">Platform Id</param>
        [HttpGet("GetPlatfomrById")]
        public async Task<IActionResult> GetPlatformById(int Id)
        {
            var platform = await platformservices.PlatformByIdAsync(Id);
            if (platform == null)
                return NotFound($"This Platform Does Not Exist");
            return Ok(new {platform.Name});
        }

        /// <summary>
        /// Create New Platform.
        /// </summary>
        /// <param name="platform">Platform Information</param>
        [HttpPost("CreatePlatform")]
        public async Task<IActionResult> CreatePlatform([FromBody] Game_Library_Management_BL.DTO_s.PlatformsDto.PlatformCreateDto platform)
        {
            var createdPlatform = await platformservices.CreatePlatformAsync(platform);
            if (createdPlatform == null)
                return BadRequest("Could not create Platform");

            return CreatedAtAction(nameof(GetPlatformById), new { id = createdPlatform.Id }, new { createdPlatform.Name });
        }

        /// <summary>
        /// Remove a Platform.
        /// </summary>
        /// <param name="Id">Platform Id</param>
        [HttpDelete]
        public async Task<IActionResult> DeletePlatform(int Id)
        {
            var result = await platformservices.RemovePlatformAsync(Id);
            if (!result)
                return BadRequest("Could not delete Platform");

            return Ok("Platform Deleted Successfully");
        }
    }
}
