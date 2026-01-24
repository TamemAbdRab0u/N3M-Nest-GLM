using Game_Library_Management_BL.DTO_s;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.Services.Services;
using Game_Library_Management_BL.UnitOfWork;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GamesController : ControllerBase
    {
        private readonly IGameServices gameservices;
        public GamesController(IGameServices gameservices)
        {
            this.gameservices = gameservices;
        }


        /// <summary>
        /// Return All Games.
        /// </summary>
        [HttpGet("GetAllGames")]
        public async Task<IActionResult> GetAllGames()
        {
            var Games = await gameservices.AllGamesAsync();
            return Ok(Games);
        }

        /// <summary>
        /// Return a Single Game.
        /// </summary>
        /// <param name="Id">Game Id</param>
        [HttpGet("GetGameById")]
        public async Task<IActionResult> GetGameById(int Id)
        {
            var game = await gameservices.GameByIdAsync(Id);
            if (game == null)
                return NotFound();
            return Ok(game);
        }

        /// <summary>
        /// Create New Game.
        /// </summary>
        /// <param name="game">The Game Details</param>
        [HttpPost("CreateGame")]
        public async Task<IActionResult> CreateGame([FromForm] GameCreateDto game)
        {
            var CreatedGame = await gameservices.CreateGameAsync(game);
            return CreatedAtAction(nameof(GetGameById), new { id = CreatedGame.Id }, CreatedGame);
        }

        /// <summary>
        /// Update and Existing Game.
        /// </summary>
        /// <param name="Id">Game Id</param>
        /// <param name="game">The Game Details</param>
        [HttpPut("UpdateGame")]
        public async Task<IActionResult> UpdateGame(int Id, [FromForm] GameUpdateDto game)
        {
            var UpdatedGame = await gameservices.UpdateGameAsync(Id, game);
            if (UpdatedGame == null)
                return NotFound();

            return Ok(UpdatedGame);
        }

        /// <summary>
        /// Update an Existing Game Partially.
        /// </summary>
        /// <param name="Id">Game Id</param>
        /// <param name="game">The Game Details</param>
        [HttpPatch("{id}")]
        public async Task<ActionResult<GameResponseDto>> PatchGame(int id, [FromForm] GameUpdateDto game)
        {
            var UpdatedGame = await gameservices.PatchGameAsync(id, game);
            if (UpdatedGame == null)
                return NotFound();

            return Ok(UpdatedGame);
        }

        /// <summary>
        /// Remove a Game.
        /// </summary>
        /// <param name="Id">Game Id</param>
        [HttpDelete]
        public async Task<IActionResult> DeleteGame(int Id)
        {
            var isDeleted = await gameservices.DeleteGameAsync(Id);
            if (!isDeleted)
                return NotFound();
            return NoContent();
        }



        // Tags Management //
        /// <summary>
        /// Attach New Tag To The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        /// <param name="tagIds">Enter Tags Id</param>
        [HttpPost("AttachTags")]
        public async Task<IActionResult> AttachTagsToGame(int gameId, [FromBody] List<int> tagIds)
        {
            var isSuccess = await gameservices.AddTagsToGameAsync(gameId, tagIds);
            if (!isSuccess)
                return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Replace Tags of The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        /// <param name="tagIds">Enter Tags Id</param>
        [HttpPost("ReplaceTags")]
        public async Task<IActionResult> ReplaceTagsOfGame(int gameId, [FromBody] List<int> tagIds)
        {
            var isSuccess = await gameservices.ReplaceGameTagsAsync(gameId, tagIds);
            if (!isSuccess)
                return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Remove Single Tag From The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        /// <param name="tagId">Enter Tag Id</param>
        [HttpDelete("RemoveTag")]
        public async Task<IActionResult> RemoveTagFromGame(int gameId, int tagId)
        {
            var isSuccess = await gameservices.RemoveTagFromGameAsync(gameId, tagId);
            if (!isSuccess)
                return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Remove All Tags From The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        [HttpDelete("RemoveTags")]
        public async Task<IActionResult> RemoveTagsFromGame(int gameId)
        {
            var isSuccess = await gameservices.RemoveTagFromGameAsync(gameId);
            if (!isSuccess)
                return NotFound();
            return NoContent();
        }



        // Platforms Management //
        /// <summary>
        /// Attach New Platform For The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        /// <param name="platformIds">Enter Platforms Id</param>
        [HttpPost("AttachPlatforms")]
        public async Task<IActionResult> AttachPlatformsToGame(int gameId, [FromBody] List<int> platformIds)
        {
            var isSuccess = await gameservices.AddPlatformsToGameAsync(gameId, platformIds);
            if (!isSuccess)
                return NotFound();

            return NoContent();
        }

        /// <summary>
        /// Remove Single Platform From The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        /// <param name="platformId">Enter platform Id</param>
        /// 
        [HttpDelete("RemovePlatform")]
        public async Task<IActionResult> RemovePlatformFromGame(int gameId, int platformId)
        {
            var isSuccess = await gameservices.RemovePlatformFromGameAsync(gameId, platformId);
            if (!isSuccess)
                return NotFound();

            return NoContent();
        }

        /// <summary>
        /// Remove All Platforms From The Game.
        /// </summary>
        /// <param name="gameId">Enter Game Id</param>
        [HttpDelete("RemovePlatforms")]
        public async Task<IActionResult> RemovePlatformsFromGame(int gameId)
        {
            var isSuccess = await gameservices.RemovePlatformsFromGameAsync(gameId);
            if (!isSuccess)
                return NotFound();

            return NoContent();
        }
    }
}
