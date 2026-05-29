using Game_Library_Management_BL.DTO_s.ReviewDto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IReviewServices
    {
        Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int ExternalId, string userId = null);
        Task<IEnumerable<ReviewResponseDto>> GetUserReviewsAsync(string username, int? count = null);
        Task<ReviewResponseDto> CreateReviewAsync(string UserId, CreateReviewDto dto);
        Task<ReviewResponseDto> UpdateReviewAsync(string UserId, int ReviewId, UpdateReviewDto dto);
        Task<bool> DeleteReviewAsync(int ReviewId);
        Task<ReviewResponseDto> VoteReviewAsync(int ReviewId, string UserId, bool? isLike);
    }
}
