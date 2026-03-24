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


        public async Task<IEnumerable<ReviewResponseDto>> GetReviewsAsync(int externalId, string userId = null)
        {
            var reviews = await unitofwork.Reviews.Query()
                .Where(x => x.ExternalId == externalId)
                .Include(x => x.User)
                .Include(x => x.Votes)
                .ToListAsync();

            return reviews.Select(x => new ReviewResponseDto
            {
                ReviewId = x.ReviewId,
                UserName = x.User.Username,
                ImageUrl = x.User.ImageUrl,
                Rating = x.Rating,
                Comment = x.Comment,
                CreatedAt = x.CreatedAt,
                Likes = x.Votes.Count(v => v.IsLike),
                Dislikes = x.Votes.Count(v => !v.IsLike),
                UserVote = userId != null
                    ? x.Votes.FirstOrDefault(v => v.UserId == userId)?.IsLike
                    : null
            }).ToList();
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

        public async Task<ReviewResponseDto> VoteReviewAsync(int ReviewId, string UserId, bool? isLike)
        {
            if (string.IsNullOrWhiteSpace(UserId))
                throw new UnauthorizedAccessException("User not authenticated.");

            var review = await unitofwork.Reviews.Query()
                .Include(r => r.Votes)
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.ReviewId == ReviewId);

            if (review == null)
                throw new KeyNotFoundException("Review not found.");

            var existing = review.Votes.FirstOrDefault(v => v.UserId == UserId);

            if (isLike == null)
            {
                if (existing != null)
                {
                    await unitofwork.ReviewVotes.DeleteAsync(existing);
                    unitofwork.Save();
                }
            }
            else if (existing != null)
            {
                if (existing.IsLike == isLike.Value)
                {
                    await unitofwork.ReviewVotes.DeleteAsync(existing);
                    unitofwork.Save();
                }
                else
                {
                    existing.IsLike = isLike.Value;
                    await unitofwork.ReviewVotes.Update(existing);
                    unitofwork.Save();
                }
            }
            else
            {
                var vote = new ReviewVote
                {
                    ReviewId = ReviewId,
                    UserId = UserId,
                    IsLike = isLike.Value,
                    CreatedAt = DateTime.UtcNow
                };
                await unitofwork.ReviewVotes.Add(vote);
                unitofwork.Save();
            }

            var updatedReview = await unitofwork.Reviews.Query()
                .Include(r => r.Votes)
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.ReviewId == ReviewId);

            var userVoteAfter = updatedReview?.Votes.FirstOrDefault(v => v.UserId == UserId);

            return new ReviewResponseDto
            {
                ReviewId = updatedReview.ReviewId,
                UserName = updatedReview.User?.Username,
                ImageUrl = updatedReview.User?.ImageUrl,
                Rating = updatedReview.Rating,
                Comment = updatedReview.Comment,
                CreatedAt = updatedReview.CreatedAt,
                Likes = updatedReview.Votes.Count(v => v.IsLike),
                Dislikes = updatedReview.Votes.Count(v => !v.IsLike),
                UserVote = userVoteAfter?.IsLike
            };
        }

        public async Task<IEnumerable<ReviewResponseDto>> GetUserReviewsAsync(string username, int? count = null)
        {
            var user = await unitofwork.Users.Query()
                .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());

            if (user == null) return new List<ReviewResponseDto>();

            // 1. Fetch the reviews first with necessary Includes to avoid anonymous type projection errors
            var reviews = await unitofwork.Reviews.Query()
                .Where(r => r.UserId == user.Id)
                .Include(r => r.Votes)
                .Include(r => r.User)
                .OrderByDescending(r => r.CreatedAt)
                .Take(count ?? 3)
                .ToListAsync();

            if (!reviews.Any()) return new List<ReviewResponseDto>();

            // 2. Fetch game metadata for these reviews (using distinct IDs)
            var externalIds = reviews.Select(r => r.ExternalId).Distinct().ToList();
            var games = await unitofwork.Games.Query()
                .Where(g => externalIds.Contains(g.ExternalId))
                .Select(g => new { g.ExternalId, g.Title, g.PosterImageUrl })
                .ToListAsync();

            // Group by ExternalId to handle potential duplicates in the database and avoid dictionary crashes
            var gameDict = games.GroupBy(g => g.ExternalId)
                                .ToDictionary(g => g.Key, g => g.First());

            // 3. Map to DTOs
            return reviews.Select(r =>
            {
                gameDict.TryGetValue(r.ExternalId, out var g);
                return new ReviewResponseDto
                {
                    ReviewId = r.ReviewId,
                    ExternalId = r.ExternalId,
                    UserName = r.User?.Username ?? username,
                    ImageUrl = r.User?.ImageUrl,
                    Rating = r.Rating,
                    Comment = r.Comment,
                    CreatedAt = r.CreatedAt,
                    Likes = r.Votes?.Count(v => v.IsLike) ?? 0,
                    Dislikes = r.Votes?.Count(v => !v.IsLike) ?? 0,
                    GameTitle = g?.Title ?? "Unknown Game",
                    GamePosterUrl = g?.PosterImageUrl
                };
            }).ToList();
        }
    }
}
