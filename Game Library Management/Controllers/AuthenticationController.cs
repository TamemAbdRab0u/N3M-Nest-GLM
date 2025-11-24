using Game_Library_Management_BL.DTO_s.Authentication;
using Game_Library_Management_BL.Services.IServices;
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
    }
}
