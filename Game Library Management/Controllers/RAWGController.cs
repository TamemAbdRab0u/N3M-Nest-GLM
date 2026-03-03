using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.Services.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RAWGController : ControllerBase
    {
        private readonly IRAWGService _gameCatalogService;
        public RAWGController(IRAWGService gameCatalogService)
        {
            _gameCatalogService = gameCatalogService;
        }

        [HttpGet("catalog/{id}")]
        public async Task<IActionResult> GetGameDetails(int id)
        {
            var details = await _gameCatalogService.GetGameDetailsAsync(id);
            if (details == null) return NotFound();
            return Ok(details);
        }

        [HttpGet("catalog/GetAll")]
        public async Task<IActionResult> GetAllGames([FromQuery] int page = 1, [FromQuery] string? genre = null, [FromQuery] string? platforms = null, [FromQuery] string? ordering = null, [FromQuery] string? dates = null)
        {
            var games = await _gameCatalogService.GetAllGamesAsync(page, genre, platforms, ordering, dates);
            return Ok(games);
        }

        [HttpGet("catalog/genres")]
        public async Task<IActionResult> GetAllGenres()
        {
            var genres = await _gameCatalogService.GetAllGenresAsync();
            return Ok(genres);
        }

        [HttpGet("catalog/platforms")]
        public async Task<IActionResult> GetAllPlatforms()
        {
            var platforms = await _gameCatalogService.GetAllPlatformsAsync();
            return Ok(platforms);
        }

        [HttpGet("catalog/search")]
        public async Task<IActionResult> SearchCatalog(string query)
        {
            var games = await _gameCatalogService.SearchGamesAsync(query);
            return Ok(games);
        }

        [HttpPost("catalog/import")]
        public async Task<IActionResult> ImportFromRawg(string query)
        {
            var games = await _gameCatalogService.SearchGamesAsync(query);
            await _gameCatalogService.ImportGamesAsync(games);
            return Ok("Games imported successfully");
        }

        [HttpPost("catalog/favorite/{externalId}")]
        public async Task<IActionResult> ToggleFavorite(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _gameCatalogService.ToggleFavoriteAsync(userId, externalId);
            return Ok(new { IsFavorite = result });
        }

        [HttpPost("catalog/library/{externalId}")]
        public async Task<IActionResult> AddToLibrary(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _gameCatalogService.AddToLibraryAsync(userId, externalId);
            return Ok(new { Added = result });
        }

        [HttpPost("catalog/wishlist/{externalId}")]
        public async Task<IActionResult> ToggleWishlist(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _gameCatalogService.ToggleWishlistAsync(userId, externalId);
            return Ok(new { Added = result });
        }
    }
}
