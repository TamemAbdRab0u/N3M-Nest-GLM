using Game_Library_Management_BL.DTO_s.ReviewDto;
using Game_Library_Management_BL.Services.IServices;
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
        public async Task<IActionResult> CreateReview(CreateReviewDto dto)
        {
            if (dto == null)
            {
                return BadRequest("Review data is required.");
            }

            var userId = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized("User not authenticated.");
            }

            var createdReview = await reviewServices.CreateReviewAsync(userId, dto);
            return Ok(createdReview);

        }
    }
}
