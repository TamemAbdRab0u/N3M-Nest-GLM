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
                existing = new Review
                {
                    UserId = UserId,
                    ExternalId = dto.ExternalId,
                    Rating = dto.Rating,
                    Comment = dto.Comment,
                    CreatedAt = DateTime.UtcNow,
                };
                await unitofwork.Reviews.Add(existing);
            }

            unitofwork.Save();

            var user = await unitofwork.Users.Query().FirstOrDefaultAsync(u => u.Id == UserId);

            return new ReviewResponseDto
            {
                ReviewId = existing.ReviewId,
                UserName = user?.Username ?? "Unknown",
                ImageUrl = user?.ImageUrl,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = existing.CreatedAt
            };
        }


        public async Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int externalId)
        {
            var reviews = await unitofwork.Reviews.Query()
                .Where(x => x.ExternalId == externalId)
                .Include(x => x.User)
                .Select(x => new ReviewResponseDto
                {
                    ReviewId = x.ReviewId,
                    UserName = x.User.Username,
                    ImageUrl = x.User.ImageUrl,
                    Rating = x.Rating,
                    Comment = x.Comment,
                    CreatedAt = x.CreatedAt
                }).ToListAsync();

            return reviews;
        }

        public async Task<ReviewResponseDto> UpdateReviewAsync(string UserId, int ReviewId, UpdateReviewDto dto)
        {
            if (string.IsNullOrWhiteSpace(UserId))
                throw new UnauthorizedAccessException("User not authenticated.");

            var userReview = await unitofwork.Reviews.Query().FirstOrDefaultAsync(x => x.ReviewId == ReviewId);

            if(userReview == null || userReview.UserId != UserId)
                throw new UnauthorizedAccessException("you not allowed to update this review.");

            userReview.Rating = dto.Rating;
            userReview.Comment = dto.Comment;

            await unitofwork.Reviews.Update(userReview);
            unitofwork.Save();

            var user = await unitofwork.Users.Query().FirstOrDefaultAsync(u => u.Id == UserId);

            return new ReviewResponseDto
            {
                ReviewId = userReview.ReviewId,
                UserName = user?.Username ?? "Unknown",
                ImageUrl = user?.ImageUrl,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = userReview.CreatedAt
            };
        }

        public async Task<bool> DeleteReviewAsync(int ReviewId)
        {
            if (ReviewId <= 0)
                return false;

            var review = unitofwork.Reviews.Query().FirstOrDefault(r => r.ReviewId == ReviewId);

            if (review == null)
                return false;

            await unitofwork.Reviews.DeleteAsync(review);
            unitofwork.Save();
            return true;
        }
    }
}
