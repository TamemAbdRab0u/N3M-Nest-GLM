using Game_Library_Management_BL.DTO_s.UserGamesDto;
using Game_Library_Management_BL.DTO_s.GamesDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.Services.Services;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserGamesController : ControllerBase
    {
        private readonly IUserGamesServices usergameService;
        public UserGamesController(IUserGamesServices usergameService)
        {
            this.usergameService = usergameService;
        }

        /// <summary>
        /// Return All User Games.
        /// </summary>
        [HttpGet("GetAllUserGames")]
        public async Task<IActionResult> GetAllUserGames()
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var result = await usergameService.AllUserGamesAsync(userId);
            return Ok(result ?? new List<UserGamesResponseDto>());
        }

        /// <summary>
        /// Get user games by status.
        /// </summary>
        /// <param name="status">Gamestatus enum value</param>
        [HttpGet("GetByStatus/{status}")]
        public async Task<IActionResult> GetByStatus([FromRoute] Gamestatus status)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var result = await usergameService.GetUserGamesByStatusAsync(userId, status);
            return Ok(result ?? new List<UserGamesResponseDto>());
        }

        /// <summary>
        /// Return all games for a public user profile (by username).
        /// </summary>
        /// <param name="username">Username</param>
        [HttpGet("GetPublicGames/{username}")]
        public async Task<IActionResult> GetPublicGames([FromRoute] string username)
        {
            var result = await usergameService.GetPublicUserGamesAsync(username);
            return Ok(result ?? new List<UserGamesResponseDto>());
        }

        /// <summary>
        /// Return a Single User Game.
        /// </summary>
        /// <param name="gameId">Game Id</param>
        [HttpGet("GetUserGameById/{gameId}")]
        public async Task<IActionResult> GetUserGameById([FromRoute] int gameId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var result = await usergameService.UserGameByIdAsync(userId, gameId);
            if (result == null)
                return NotFound();

            return Ok(result);
        }

        /// <summary>
        /// Create New User Game.
        /// </summary>
        /// <param name="createDto">Game Information</param>
        [HttpPost("CreateUserGame")]
        public async Task<IActionResult> CreateUserGame([FromBody] UserGamesCreateDto createDto)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            try
            {
                var result = await usergameService.AddUserGameAsync(userId, createDto.GameId, createDto);
                if (result == null)
                    return BadRequest("Could Not Create UserGame");
                return CreatedAtAction(nameof(GetUserGameById), new { gameId = createDto.GameId }, result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Update an Existing User Game.
        /// </summary>
        /// <param name="updateDto">Game Information</param>
        [HttpPatch("UpdateUserGame")]
        public async Task<IActionResult> UpdateUserGame([FromBody] UserGamesCreateDto updateDto)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var result = await usergameService.UpdateUserGameAsync(userId, updateDto.GameId, updateDto);
            if (result == null)
                return NotFound();

            return Ok(result);
        }

        /// <summary>
        /// Remove a User Game.
        /// </summary>
        /// <param name="GameId">Game Id</param>
        [HttpDelete("DeleteUserGame/{gameId}")]
        public async Task<IActionResult> DeleteUserGame([FromRoute]int GameId)
        {
            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            if(string.IsNullOrEmpty(GameId.ToString()))
                return BadRequest("Problem Retreving This game.");

            var result = await usergameService.DeleteUserGameAsync(userId, GameId);
            if (!result)
                return NotFound();

            return NoContent();
        }
    }
}
