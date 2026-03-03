using Game_Library_Management_DAL.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommunityController : ControllerBase
    {
        private readonly AppDbContext context;
        public CommunityController(AppDbContext context)
        {
            this.context = context;
        }

        /// <summary>
        ///  Return the last 20 messages from the community chat
        /// </summary>
        [HttpGet("History")]
        public IActionResult Index([FromQuery] int limit = 100)
        {
            limit = Math.Clamp(limit, 1, 200);

            var messages = context.Messages
                .OrderByDescending(m => m.SentAt)
                .Take(limit)
                .OrderBy(m => m.SentAt)
                .ToList();

            return Ok(messages);
        }
    }
}
