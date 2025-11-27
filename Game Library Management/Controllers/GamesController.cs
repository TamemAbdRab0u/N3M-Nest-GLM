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

        [HttpGet("GetAllGames")]
        public async Task<IActionResult> GetAllGames()
        {
            var Games = await gameservices.AllGamesAsync();
            return Ok(Games);
        }

        [HttpGet("GetGameById")]
        public async Task<IActionResult> GetGameById(int Id)
        {
            var game = await gameservices.GameByIdAsync(Id);
            if(game == null)
                return NotFound();
            return Ok(game);
        }

        [HttpPost("CreateGame")]
        public async Task<IActionResult> CreateGame([FromForm] GameCreateDto game)
        {
            var CreatedGame = await gameservices.CreateGameAsync(game);
            return CreatedAtAction(nameof(GetGameById), new {id = CreatedGame.Id}, CreatedGame);
        }

        [HttpPut("UpdateGame")]
        public async Task<IActionResult> UpdateGame(int Id, [FromForm] GameUpdateDto game)
        {
            var UpdatedGame = await gameservices.UpdateGameAsync(Id, game);
            if (UpdatedGame == null)
                return NotFound();

            return Ok(UpdatedGame);
        }

        [HttpPatch("{id}")]
        public async Task<ActionResult<GameResponseDto>> PatchGame(int id, [FromForm] GameUpdateDto game)
        {
            var UpdatedGame = await gameservices.PatchGameAsync(id, game);
            if (UpdatedGame == null)
                return NotFound();

            return Ok(UpdatedGame);
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteGame(int Id)
        {
            var isDeleted =  await gameservices.DeleteGameAsync(Id);
            if(!isDeleted)
                return NotFound();
            return NoContent();
        }
    }
}
