using Game_Library_Management_BL.DTO_s.FriendshipDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IFriendshipService
    {
        Task<FriendshipStatusDto> GetStatusAsync(string currentUserId, string targetUsername);
        Task<FriendDto> SendRequestAsync(string currentUserId, string targetUsername);
        Task<FriendDto> AcceptRequestAsync(string currentUserId, int friendshipId);
        Task RemoveAsync(string currentUserId, int friendshipId);
        Task<IEnumerable<FriendDto>> GetFriendsAsync(string username);
        Task<IEnumerable<FriendDto>> GetPendingRequestsAsync(string currentUserId);
    }
}
