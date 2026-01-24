using Game_Library_Management_BL.UnitOfWork;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using Game_Library_Management_BL.DTO_s.Stats;
using Game_Library_Management_BL.Services.IServices;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StatsController : ControllerBase
    {
        private readonly IStatsService statsservice;
        public StatsController(IStatsService statsservice)
        {
            this.statsservice = statsservice;
        }

        /// <summary>
        /// Return Completed Games.
        /// </summary>
        [HttpGet("CompletedGames")]
        public async Task<IActionResult> GetComletedGamesAsync()
        {
            var UserID = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserID))
                return Unauthorized();

            var CompletedGames = await statsservice.CompletedGamesAsync(UserID);

            if (!CompletedGames.Any())
            {
                return NotFound("No completed games found.");
            }

            return Ok(CompletedGames);
        }

        /// <summary>
        /// Return Currentlly Playing Games.
        /// </summary>
        [HttpGet("PlayingGames")]
        public async Task<IActionResult> GetPlayingGamesAsync()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var PlayingGames = await statsservice.PlayingGamesAsync(UserId);

            if (!PlayingGames.Any())
            {
                return NotFound("No playing games found.");
            }

            return Ok(PlayingGames);
        }

        /// <summary>
        /// Return Whishlisted Games.
        /// </summary>
        [HttpGet("WhishlistedGames")]
        public async Task<IActionResult> GetWhishlistedGamesAsync()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var WhishlistedGames = await statsservice.WhishlistedGamesAsync(UserId);

            if (!WhishlistedGames.Any())
            {
                return NotFound("No whishlisted games found.");
            }

            return Ok(WhishlistedGames);
        }


        /// <summary>
        /// Return Dropped Games.
        /// </summary>
        [HttpGet("DroppedGames")]
        public async Task<IActionResult> GetDroppedGamesAsync()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var DroppedGames = await statsservice.DroppedGamesAsync(UserId);

            if (!DroppedGames.Any())
            {
                return NotFound("No dropped games found.");
            }

            return Ok(DroppedGames);
        }
    }
}
