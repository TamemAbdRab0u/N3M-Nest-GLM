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
        Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int ExternalId);
        Task<ReviewResponseDto> CreateReviewAsync(string UserId, CreateReviewDto dto);
    }
}
