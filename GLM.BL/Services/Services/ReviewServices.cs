using Game_Library_Management_BL.DTO_s.ReviewDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.CodeAnalysis.CSharp.Syntax;
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
            {
                throw new UnauthorizedAccessException("User not authenticated.");
            }

            var review = new Review
            {
                UserId = UserId,
                ExternalId = dto.ExternalId,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = DateTime.UtcNow,
            };

            if(review == null)
                {
                    throw new Exception("Failed to create review.");
                }

            await unitofwork.Reviews.Add(review);
            unitofwork.Save();

            return new ReviewResponseDto
            {
                UserName = review.User.Username,
                ImageUrl = review.User.ImageUrl,
                Rating = review.Rating,
                Comment = review.Comment,
                CreatedAt = review.CreatedAt
            };
        }

        public async Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int externalId)
        {
            var gameExists = await unitofwork.Games.Query().AnyAsync(x => x.ExternalId == externalId);
            if (!gameExists)
            {
                throw new Exception("Game not found.");
            }

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
