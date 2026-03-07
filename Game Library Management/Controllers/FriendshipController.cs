using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FriendshipController : ControllerBase
    {
        private readonly IFriendshipService friendshipService;

        public FriendshipController(IFriendshipService friendshipService)
        {
            this.friendshipService = friendshipService;
        }

        private string? CurrentUserId => User.FindFirst("uid")?.Value;

        [HttpGet("status/{username}")]
        public async Task<IActionResult> GetStatus([FromRoute] string username)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var status = await friendshipService.GetStatusAsync(userId, username);
            return Ok(status);
        }

        [HttpGet("friends/{username}")]
        public async Task<IActionResult> GetFriends([FromRoute] string username)
        {
            try
            {
                var friends = await friendshipService.GetFriendsAsync(username);
                return Ok(friends);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            var userId = CurrentUserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var pending = await friendshipService.GetPendingRequestsAsync(userId);
            return Ok(pending);
        }

        [HttpPost("send/{username}")]
        public async Task<IActionResult> SendRequest([FromRoute] string username)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            try
            {
                var result = await friendshipService.SendRequestAsync(userId, username);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("accept/{friendshipId:int}")]
        public async Task<IActionResult> AcceptRequest([FromRoute] int friendshipId)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            try
            {
                var result = await friendshipService.AcceptRequestAsync(userId, friendshipId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("remove/{friendshipId:int}")]
        public async Task<IActionResult> Remove([FromRoute] int friendshipId)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            try
            {
                await friendshipService.RemoveAsync(userId, friendshipId);
                return NoContent();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}
