using Game_Library_Management_BL.DTO_s.Authentication;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Game_Library_Management.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthenticationController : ControllerBase
    {
        private readonly IAuthenticationService authenticationService;
        public AuthenticationController(IAuthenticationService authenticationService)
        {
            this.authenticationService = authenticationService;
        }

        [HttpPost("Register")]
        public async Task<IActionResult> RegisterAsync([FromBody]RegisterDto model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await authenticationService.RegisterAsync(model);

            if (!result.IsAuthenticated)
                return BadRequest(result);

            return Ok(result);
        }

        [HttpPost("Login")]
        public async Task<IActionResult> LoginAsync([FromBody] LoginDto model)
        {
            if(!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await authenticationService.LoginAsync(model);

            if(!result.IsAuthenticated)
                return BadRequest(result);

            if (!string.IsNullOrEmpty(result.RefreshToken))
            {
                AssignRefreshTokenAsCookie(result.RefreshToken, result.RefershTokenExpiration);
            }

            return Ok(result);
        }

        [HttpPost("AddToRole")]
        public async Task<IActionResult> AddToRoleAsync([FromBody]AddRoleDto model)
        {
           if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await authenticationService.AddToRoleAsync(model);

            if (string.IsNullOrEmpty(result))
                return BadRequest(result);

            return Ok(result);
        }

        [HttpGet("NewRefreshToken")]
        public async Task<IActionResult> NewRefreshTokenAsync()
        {
            var refreshToken = Request.Cookies["refreshToken"];
            var result = await authenticationService.NewRefreshTokenAsyc(refreshToken);

            if(!result.IsAuthenticated)
                return BadRequest(result);

            AssignRefreshTokenAsCookie(result.RefreshToken, result.RefershTokenExpiration);
            return Ok(result);
        }

        [HttpGet]
        private void AssignRefreshTokenAsCookie(string refreshToken, DateTime expire)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Expires = expire.ToLocalTime()
            };

            Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);
        }
    }
}
