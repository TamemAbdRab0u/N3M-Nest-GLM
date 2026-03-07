using Game_Library_Management_BL.DTO_s.FriendshipDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class FriendshipService : IFriendshipService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly UserManager<ApplicationUser> userManager;

        public FriendshipService(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager)
        {
            this.unitOfWork = unitOfWork;
            this.userManager = userManager;
        }

        private async Task<User?> ResolveUserByUsernameAsync(string username)
        {
            return await unitOfWork.Users.Query()
                .FirstOrDefaultAsync(u => u.Username == username);
        }

        private async Task<FriendDto> BuildFriendDtoAsync(Friendship f, string currentUserId)
        {
            bool isSentByMe = f.RequesterId == currentUserId;
            string otherUserId = isSentByMe ? f.AddresseeId : f.RequesterId;

            var otherUser = await unitOfWork.Users.Query()
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == otherUserId);

            return new FriendDto
            {
                FriendshipId = f.Id,
                UserId = otherUserId,
                Username = otherUser?.Username ?? string.Empty,
                DisplayName = otherUser?.Profile?.DisplayName,
                AvatarUrl = otherUser?.Profile?.AvatarUrl,
                Status = f.Status.ToString(),
                IsSentByMe = isSentByMe
            };
        }

        public async Task<FriendshipStatusDto> GetStatusAsync(string currentUserId, string targetUsername)
        {
            var targetUser = await ResolveUserByUsernameAsync(targetUsername);

            int friendsCount = 0;
            if (targetUser != null)
            {
                friendsCount = await unitOfWork.Friendships.Query()
                    .CountAsync(f => f.Status == FriendshipStatus.Accepted &&
                                    (f.RequesterId == targetUser.Id || f.AddresseeId == targetUser.Id));
            }

            if (targetUser == null)
                return new FriendshipStatusDto { FriendsCount = friendsCount };

            var friendship = await unitOfWork.Friendships.Query()
                .FirstOrDefaultAsync(f =>
                    (f.RequesterId == currentUserId && f.AddresseeId == targetUser.Id) ||
                    (f.RequesterId == targetUser.Id && f.AddresseeId == currentUserId));

            if (friendship == null)
                return new FriendshipStatusDto { Status = null, FriendsCount = friendsCount };

            return new FriendshipStatusDto
            {
                Status = friendship.Status.ToString(),
                IsSentByMe = friendship.RequesterId == currentUserId,
                FriendshipId = friendship.Id,
                FriendsCount = friendsCount
            };
        }

        public async Task<FriendDto> SendRequestAsync(string currentUserId, string targetUsername)
        {
            var targetUser = await ResolveUserByUsernameAsync(targetUsername)
                ?? throw new InvalidOperationException("User not found.");

            if (targetUser.Id == currentUserId)
                throw new InvalidOperationException("Cannot send a friend request to yourself.");

            var existing = await unitOfWork.Friendships.Query()
                .FirstOrDefaultAsync(f =>
                    (f.RequesterId == currentUserId && f.AddresseeId == targetUser.Id) ||
                    (f.RequesterId == targetUser.Id && f.AddresseeId == currentUserId));

            if (existing != null)
                throw new InvalidOperationException("Friendship or pending request already exists.");

            var friendship = new Friendship
            {
                RequesterId = currentUserId,
                AddresseeId = targetUser.Id,
                Status = FriendshipStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            await unitOfWork.Friendships.Add(friendship);
            unitOfWork.Save();

            return await BuildFriendDtoAsync(friendship, currentUserId);
        }

        public async Task<FriendDto> AcceptRequestAsync(string currentUserId, int friendshipId)
        {
            var friendship = await unitOfWork.Friendships.Query()
                .FirstOrDefaultAsync(f => f.Id == friendshipId)
                ?? throw new InvalidOperationException("Friendship not found.");

            if (friendship.AddresseeId != currentUserId)
                throw new UnauthorizedAccessException("Only the recipient can accept a request.");

            if (friendship.Status != FriendshipStatus.Pending)
                throw new InvalidOperationException("Request is not pending.");

            friendship.Status = FriendshipStatus.Accepted;
            await unitOfWork.Friendships.Update(friendship);
            unitOfWork.Save();

            return await BuildFriendDtoAsync(friendship, currentUserId);
        }

        public async Task<FriendDto> RemoveAsync(string currentUserId, int friendshipId)
        {
            var friendship = await unitOfWork.Friendships.Query()
                .FirstOrDefaultAsync(f => f.Id == friendshipId)
                ?? throw new InvalidOperationException("Friendship not found.");

            if (friendship.RequesterId != currentUserId && friendship.AddresseeId != currentUserId)
                throw new UnauthorizedAccessException("Not part of this friendship.");

            // Identify the other party before deleting
            string otherUserId = friendship.RequesterId == currentUserId
                ? friendship.AddresseeId
                : friendship.RequesterId;

            var otherUser = await unitOfWork.Users.Query()
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == otherUserId);

            await unitOfWork.Friendships.DeleteAsync(friendship);
            unitOfWork.Save();

            return new FriendDto
            {
                FriendshipId = friendshipId,
                UserId       = otherUserId,
                Username     = otherUser?.Username ?? string.Empty,
                DisplayName  = otherUser?.Profile?.DisplayName,
                AvatarUrl    = otherUser?.Profile?.AvatarUrl,
                Status       = friendship.Status.ToString(),
                IsSentByMe   = friendship.RequesterId == currentUserId
            };
        }

        public async Task<IEnumerable<FriendDto>> GetFriendsAsync(string username)
        {
            var user = await ResolveUserByUsernameAsync(username)
                ?? throw new InvalidOperationException("User not found.");

            var friendships = await unitOfWork.Friendships.Query()
                .Where(f => f.Status == FriendshipStatus.Accepted &&
                            (f.RequesterId == user.Id || f.AddresseeId == user.Id))
                .ToListAsync();

            var result = new List<FriendDto>();
            foreach (var f in friendships)
            {
                bool isSentByOwner = f.RequesterId == user.Id;
                string otherUserId = isSentByOwner ? f.AddresseeId : f.RequesterId;

                var otherUser = await unitOfWork.Users.Query()
                    .Include(u => u.Profile)
                    .FirstOrDefaultAsync(u => u.Id == otherUserId);

                result.Add(new FriendDto
                {
                    FriendshipId = f.Id,
                    UserId = otherUserId,
                    Username = otherUser?.Username ?? string.Empty,
                    DisplayName = otherUser?.Profile?.DisplayName,
                    AvatarUrl = otherUser?.Profile?.AvatarUrl,
                    Status = "Accepted",
                    IsSentByMe = isSentByOwner
                });
            }
            return result;
        }

        public async Task<IEnumerable<FriendDto>> GetPendingRequestsAsync(string currentUserId)
        {
            var friendships = await unitOfWork.Friendships.Query()
                .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == currentUserId)
                .ToListAsync();

            var result = new List<FriendDto>();
            foreach (var f in friendships)
                result.Add(await BuildFriendDtoAsync(f, currentUserId));

            return result;
        }
    }
}
