using Game_Library_Management_BL.DTO_s.GamesDto_s;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GamesController : ControllerBase
    {
        private readonly IGameServices gameServices;
        public GamesController(IGameServices gameServices)
        {
            this.gameServices = gameServices;
        }

        [HttpGet("All")]
        public async Task<IActionResult> GetAllGames()
        {
            var games = await gameServices.AllGamesAsync();
            return Ok(games);
        }

        [HttpGet("ById")]
        public async Task<IActionResult> GetGameById(int id)
        {
            var game = await gameServices.GameByIdAsync(id);
            if (game == null)
            {
                return NotFound();
            }
            return Ok(game);
        }

        [HttpPost]
        public async Task<IActionResult> AddGame([FromBody] CreateGameDto game)
        {
            var addedGame = await gameServices.AddGameAsync(game);
            return Ok("Game Created");
        }

        [HttpPut]
        public async Task<IActionResult> UpdateGame([FromBody] UpdateGameDto game)
        {
            var updatedGame = await gameServices.UpdateGameAsync(game);
            return Ok("Game Updated");
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteGame(int id)
        {
            var result = await gameServices.RemoveGameAsync(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok("Game Deleted");
        }
    }
}
