using Game_Library_Management_BL.DTO_s.ReviewDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class ReviewServices : IReviewServices
    {
        private readonly IUnitOfWork unitofwork;
        public ReviewServices(IUnitOfWork unitofwork)
        {
            this.unitofwork = unitofwork;
        }

        public async Task<ReviewResponseDto> CreateReviewAsync(string UserId, CreateReviewDto dto)
        {
            if (string.IsNullOrWhiteSpace(UserId))
                throw new UnauthorizedAccessException("User not authenticated.");

            var existing = await unitofwork.Reviews.Query()
                .FirstOrDefaultAsync(r => r.ExternalId == dto.ExternalId && r.UserId == UserId);

            if (existing != null)
            {
                existing.Rating = dto.Rating;
                existing.Comment = dto.Comment;
                existing.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                var review = new Review
                {
                    UserId = UserId,
                    ExternalId = dto.ExternalId,
                    Rating = dto.Rating,
                    Comment = dto.Comment,
                    CreatedAt = DateTime.UtcNow,
                };
                await unitofwork.Reviews.Add(review);
            }

            unitofwork.Save();

            var user = await unitofwork.Users.Query().FirstOrDefaultAsync(u => u.Id == UserId);

            return new ReviewResponseDto
            {
                UserName = user?.Username ?? "Unknown",
                ImageUrl = user?.ImageUrl,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = DateTime.UtcNow
            };
        }

        public async Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int externalId)
        {
            var reviews = await unitofwork.Reviews.Query()
                .Where(x => x.ExternalId == externalId)
                .Include(x => x.User)
                .Select(x => new ReviewResponseDto
                {
                    UserName = x.User.Username,
                    ImageUrl = x.User.ImageUrl,
                    Rating = x.Rating,
                    Comment = x.Comment,
                    CreatedAt = x.CreatedAt
                }).ToListAsync();

            return reviews;
        }
    }
}
