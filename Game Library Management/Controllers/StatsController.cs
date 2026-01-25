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

        /// <summary>
        /// Return Games That The User Didn't Like (Raiting Less Than[5]).
        /// </summary>
        [HttpGet("BadGames")]
        public async Task<IActionResult> GetBadGamesAsync()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var BadGames = await statsservice.BadGamesAsync(UserId);

            if (!BadGames.Any())
            {
                return NotFound("No bad games found.");
            }

            return Ok(BadGames);
        }

        /// <summary>
        /// Return Games The User Liked (Raiting Between [5-8]).
        /// </summary>
        [HttpGet("GoodGames")]
        public async Task<IActionResult> GoodGames()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var GoodGames = await statsservice.GoodGamesAsync(UserId);

            if(!GoodGames.Any())
            {
                return NotFound("No good games found.");
            }

            return Ok(GoodGames);
        }

        /// <summary>
        /// Return Games Seems To Be The User's Favourite (Raiting Greater Than [8]).
        /// </summary>
        [HttpGet("PerfectGames")]
        public async Task<IActionResult> PerfectGames()
        {
            var UserId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized();

            var PerfectGames = await statsservice.PerfectGamesAsync(UserId);

            if (!PerfectGames.Any())
            {
                return NotFound("No perfect games found.");
            }

            return Ok(PerfectGames);
        }
    }
}
