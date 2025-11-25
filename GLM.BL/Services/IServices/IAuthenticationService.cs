using Game_Library_Management_BL.DTO_s.Authentication;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.IServices
{
    public interface IAuthenticationService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto model);
        Task<AuthResponseDto> LoginAsync(LoginDto model);
        Task<string> AddToRoleAsync(AddRoleDto model);
        Task<AuthResponseDto> NewRefreshTokenAsyc(string refreshtoken);
    }
}
