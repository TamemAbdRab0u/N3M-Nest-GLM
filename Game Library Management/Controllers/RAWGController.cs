using Game_Library_Management_BL.Services.IServices;
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

        [HttpGet("catalog/search")]
        public async Task<IActionResult> SearchCatalog(string query)
        {
            var games = await _gameCatalogService.SearchGamesAsync(query);
            return Ok(games);
        }

    }
}
