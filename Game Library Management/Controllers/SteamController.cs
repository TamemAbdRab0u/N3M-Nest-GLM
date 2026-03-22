using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.DTO_s.GamesDto;
using Game_Library_Management_BL.DTO_s.GameCatalogDto;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SteamController : ControllerBase
    {
        private readonly ISteamService _steamService;

        public SteamController(ISteamService steamService)
        {
            _steamService = steamService;
        }

        [HttpGet("catalog/{id}")]
        public async Task<IActionResult> GetGameDetails(int id)
        {
            var details = await _steamService.GetGameDetailsAsync(id);
            if (details == null) return NotFound();
            return Ok(details);
        }

        [HttpGet("catalog/GetAll")]
        public async Task<IActionResult> GetAllGames([FromQuery] int page = 1, [FromQuery] string? genre = null, [FromQuery] string? platforms = null, [FromQuery] string? ordering = null, [FromQuery] string? dates = null)
        {
            var games = await _steamService.GetAllGamesAsync(page, genre, platforms, ordering, dates);
            return Ok(games);
        }

        [HttpGet("catalog/genres")]
        public async Task<IActionResult> GetAllGenres()
        {
            var genres = await _steamService.GetAllGenresAsync();
            return Ok(genres);
        }

        [HttpGet("catalog/platforms")]
        public async Task<IActionResult> GetAllPlatforms()
        {
            var platforms = await _steamService.GetAllPlatformsAsync();
            return Ok(platforms);
        }

        [HttpGet("catalog/search")]
        public async Task<IActionResult> SearchCatalog(string query)
        {
            var games = await _steamService.SearchGamesAsync(query);
            return Ok(games);
        }

        [HttpPost("catalog/import")]
        public async Task<IActionResult> ImportFromSteam(string query)
        {
            var games = await _steamService.SearchGamesAsync(query);
            await _steamService.ImportGamesAsync(games);
            return Ok("Games imported successfully");
        }

        [HttpPost("catalog/preload-popular")]
        public async Task<IActionResult> PreloadPopularCatalog([FromQuery] int take = 1000, [FromQuery] int hydrateTop = 200, [FromQuery] int skip = 0)
        {
            var result = await _steamService.PreloadPopularGamesAsync(take, hydrateTop, skip);
            return Ok(new
            {
                Skip = skip,
                result.Requested,
                result.Stored,
                result.Updated,
                result.Failed
            });
        }

        [HttpPost("catalog/sync-trailers")]
        public async Task<IActionResult> SyncTrailers([FromQuery] bool overwrite = false)
        {
            var result = await _steamService.SyncAchievementsAndTrailersAsync(overwrite);
            return Ok(new
            {
                result.Total,
                result.Updated,
                result.Skipped,
                result.Failed,
                Results = result.Results.Select(r => new { r.ExternalId, r.TrailerUrl })
            });
        }

        [HttpPost("catalog/favorite/{externalId}")]
        public async Task<IActionResult> ToggleFavorite(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _steamService.ToggleFavoriteAsync(userId, externalId);
            return Ok(new { IsFavorite = result });
        }

        [HttpPost("catalog/library/{externalId}")]
        public async Task<IActionResult> AddToLibrary(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _steamService.AddToLibraryAsync(userId, externalId);
            return Ok(new { Added = result });
        }

        [HttpPost("catalog/wishlist/{externalId}")]
        public async Task<IActionResult> ToggleWishlist(int externalId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _steamService.ToggleWishlistAsync(userId, externalId);
            return Ok(new { Added = result });
        }

        [HttpGet("catalog/{externalId}/similar")]
        public async Task<IActionResult> GetSimilarGames(int externalId)
        {
            var games = await _steamService.GetSimilarGamesAsync(externalId);
            return Ok(games);
        }

        [HttpGet("catalog/company")]
        public async Task<IActionResult> GetCompanyGames([FromQuery] string companyName, [FromQuery] int page = 1)
        {
            if (string.IsNullOrWhiteSpace(companyName))
                return BadRequest("companyName is required");
                
            var games = await _steamService.GetCompanyGamesAsync(companyName, page);
            return Ok(games);
        }
    }
}
