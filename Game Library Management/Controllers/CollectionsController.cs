using Game_Library_Management_BL.DTO_s.CollectionsDto;
using Game_Library_Management_BL.DTO_s.UserGamesDto;
using Game_Library_Management_BL.DTO_s.GamesDto;
using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CollectionsController : ControllerBase
    {
        private readonly ICollectionServices _collectionServices;

        public CollectionsController(ICollectionServices collectionServices)
        {
            _collectionServices = collectionServices;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserCollections()
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var collections = await _collectionServices.GetUserCollectionsAsync(userId);
            return Ok(collections);
        }

        [HttpPost]
        public async Task<IActionResult> CreateCollection([FromBody] CollectionCreateDto dto)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _collectionServices.CreateCollectionAsync(userId, dto);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCollection(int id)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var deleted = await _collectionServices.DeleteCollectionAsync(id, userId);
            if (!deleted) return NotFound();

            return Ok();
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCollection(int id, [FromBody] CollectionCreateDto dto)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var updated = await _collectionServices.UpdateCollectionAsync(id, userId, dto);
            if (!updated) return NotFound();

            return Ok();
        }

        [HttpPost("{collectionId}/games/{gameId}")]
        public async Task<IActionResult> AddGameToCollection(int collectionId, int gameId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _collectionServices.AddGameToCollectionAsync(collectionId, gameId, userId);
            if (!result) return BadRequest("Could not add game to collection.");

            return Ok();
        }

        [HttpDelete("{collectionId}/games/{gameId}")]
        public async Task<IActionResult> RemoveGameFromCollection(int collectionId, int gameId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _collectionServices.RemoveGameFromCollectionAsync(collectionId, gameId, userId);
            if (!result) return BadRequest("Could not remove game from collection.");

            return Ok();
        }

        [HttpGet("games/{gameId}/ids")]
        public async Task<IActionResult> GetGameCollectionIds(int gameId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var ids = await _collectionServices.GetGameCollectionIdsAsync(gameId, userId);
            return Ok(ids);
        }
    }
}
