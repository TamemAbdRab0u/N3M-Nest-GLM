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
        public IActionResult Index()
        {
            var messages = context.Messages
                .OrderBy(m => m.SentAt)
                .Take(20)
                .ToList();

            return Ok(messages);
        }
    }
}
