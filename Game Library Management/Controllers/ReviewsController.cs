using Game_Library_Management_BL.DTO_s.ReviewDto;
using Game_Library_Management_BL.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ReviewsController : ControllerBase
    {
        private readonly IReviewServices reviewServices;
        public ReviewsController(IReviewServices reviewServices)
        {
            this.reviewServices = reviewServices;
        }

        /// <summary>
        /// Return Games Reviews.
        /// </summary>
        /// <param name="ExternalId">Game Id</param>
        [HttpGet("GetAllReviews")]
        public async Task<IActionResult> GetAllReviews(int ExternalId)
        {
            if (ExternalId <= 0)
            {
                return BadRequest("Game Not Found");
            }

            var reviews = await reviewServices.GetReviewsAsync(ExternalId);

            if (!reviews.Any())
                return Ok(new List<ReviewResponseDto>());

            return Ok(reviews);
        }


        /// <summary>
        /// Add a Game Review.
        /// </summary>
        /// <param name="dto">Review Details</param>
        [HttpPost("CreateReview")]
        [Authorize]
        public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto dto)
        {
            if (dto == null)
            {
                return BadRequest("Review data is required.");
            }

            var userId = User.FindFirst("uid")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized("User not authenticated.");
            }

            var createdReview = await reviewServices.CreateReviewAsync(userId, dto);
            return Ok(createdReview);

        }


        /// <summary>
        /// Update a Game Review.
        /// </summary>
        /// <param name="dto">Review Details</param>
        [HttpPut("UpdateReview")]
        [Authorize]
        public async Task<IActionResult> UpdateReview(int ReviewId, [FromBody] UpdateReviewDto dto)
        {
            var userId = User.FindFirst("uid")?.Value;

            if (string.IsNullOrEmpty(userId))
                return Unauthorized("User not authenticated.");

            var updatedReview = await reviewServices.UpdateReviewAsync(userId, ReviewId, dto);

            if (updatedReview == null)
                return NotFound("Review not found or you do not have permission to update it.");

            return Ok(updatedReview);
        }


        /// <summary>
        /// Delete a Game Review.
        /// </summary>
        /// <param name="ReviewId">Review Details</param>
        [HttpDelete("DeleteReview")]
        [Authorize]
        public async Task<IActionResult> DeleteReview(int ReviewId)
        {
            var userId = User.FindFirst("uid")?.Value;

            if (string.IsNullOrEmpty(userId))
                return Unauthorized("User not authenticated.");

            var success = await reviewServices.DeleteReviewAsync(ReviewId);

            if (!success)
                return NotFound("Review not found or you do not have permission to delete it.");

            return NoContent();
        }
    }
}
