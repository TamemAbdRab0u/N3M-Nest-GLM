using Game_Library_Management.Hubs;
using Game_Library_Management_BL.DTO_s.FriendshipDto;
using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.IdentityModel.Tokens.Jwt;
using Game_Library_Management.Helpers;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FriendshipController : ControllerBase
    {
        private readonly IFriendshipService friendshipService;
        private readonly IProfileService profileService;
        private readonly IHubContext<NotificationHub> hubContext;
        private readonly IOnlineUserTracker onlineUserTracker;

        public FriendshipController(
            IFriendshipService friendshipService,
            IProfileService profileService,
            IHubContext<NotificationHub> hubContext,
            IOnlineUserTracker onlineUserTracker)
        {
            this.friendshipService = friendshipService;
            this.profileService = profileService;
            this.hubContext = hubContext;
            this.onlineUserTracker = onlineUserTracker;
        }

        private string? CurrentUserId => User.FindFirst("uid")?.Value;
        private string? CurrentUsername => User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

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
                foreach (var friend in friends)
                {
                    friend.IsOnline = onlineUserTracker.IsOnline(friend.UserId);
                }
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

                // Build real-time notification for the addressee
                var requesterProfile = await profileService.GetProfileAsync(userId);
                var notification = new FriendRequestNotificationDto
                {
                    FriendshipId = result.FriendshipId,
                    FromUserId   = userId,
                    FromUsername = CurrentUsername ?? string.Empty,
                    FromDisplayName = requesterProfile?.DisplayName,
                    FromAvatarUrl   = requesterProfile?.AvatarUrl,
                    EventType = "Received"
                };

                // result.UserId is the addressee's user ID
                await hubContext.Clients.User(result.UserId)
                    .SendAsync("FriendRequest", notification);

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

                // Notify the original requester that their request was accepted
                var accepterProfile = await profileService.GetProfileAsync(userId);
                var notification = new FriendRequestNotificationDto
                {
                    FriendshipId  = friendshipId,
                    FromUserId    = userId,
                    FromUsername  = CurrentUsername ?? string.Empty,
                    FromDisplayName = accepterProfile?.DisplayName,
                    FromAvatarUrl   = accepterProfile?.AvatarUrl,
                    EventType = "Accepted"
                };

                // result.UserId is the original requester's user ID
                await hubContext.Clients.User(result.UserId)
                    .SendAsync("FriendRequest", notification);

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
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
                var result = await friendshipService.RemoveAsync(userId, friendshipId);

                // If it was a pending request (not yet accepted), notify the other party
                // so they can remove it from their bell dropdown in real-time.
                if (result.Status == "Pending")
                {
                    var notification = new FriendRequestNotificationDto
                    {
                        FriendshipId    = friendshipId,
                        FromUserId      = userId,
                        FromUsername    = CurrentUsername ?? string.Empty,
                        EventType       = "Cancelled"
                    };
                    await hubContext.Clients.User(result.UserId)
                        .SendAsync("FriendRequest", notification);
                }

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
