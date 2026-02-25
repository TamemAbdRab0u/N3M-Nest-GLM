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

        [HttpGet("catalog/GetAll")]
        public async Task<IActionResult> GetAllGames([FromQuery] int page = 1)
        {
            var games = await _gameCatalogService.GetAllGamesAsync(page);
            return Ok(games);
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
    }
}
