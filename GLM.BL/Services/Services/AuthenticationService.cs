using Game_Library_Management_BL.DTO_s.Authentication;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.Helper;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;

namespace Game_Library_Management_BL.Services.Services
{
    public class AuthenticationService : IAuthenticationService
    {
        private readonly UserManager<ApplicationUser> usermanager;
        private readonly RoleManager<IdentityRole> rolemanager;
        private readonly Jwt jwt;

        public AuthenticationService(UserManager<ApplicationUser> usermanager, RoleManager<IdentityRole> rolemanager, IOptions<Jwt> jwt)
        {
            this.usermanager = usermanager;
            this.rolemanager = rolemanager;
            this.jwt = jwt.Value;
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto model)
        {
            if(await usermanager.FindByEmailAsync(model.Email) is not null)
            {
                return new AuthResponseDto
                {
                    Message = "This Email Is Already Registerd",
                    IsAuthenticated = false
                };
            }

            if (await usermanager.FindByNameAsync(model.UserName) is not null)
            {
                return new AuthResponseDto
                {
                    Message = "This UserName Is Already Registerd",
                    IsAuthenticated = false
                };
            }

            var user = new ApplicationUser
            {
                FirstName = model.FirstName,
                LastName = model.LastName,
                UserName = model.UserName,
                Email = model.Email,
            };

            var result = await usermanager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
            {
                var errors = string.Empty;
                foreach(var error in result.Errors)
                {
                    errors +=$"{error.Description}, ";
                }

                return new AuthResponseDto
                {
                    Message = errors,
                    IsAuthenticated = false
                };
            }

            await usermanager.AddToRoleAsync(user, "User");

            var jwtSecurityToken = await CreateJwtToken(user);

            return new AuthResponseDto
            {
                Message = "- Registerd Successfully -",
                UserName = user.UserName,
                Email = user.Email,
                IsAuthenticated = true,
                UserRoles = new List<string> { "User" },
                Token = new JwtSecurityTokenHandler().WriteToken(jwtSecurityToken),
                ExpiresOn = jwtSecurityToken.ValidTo
            };
        }

        private async Task<JwtSecurityToken> CreateJwtToken(ApplicationUser user)
        {
            var UserClaims = await usermanager.GetClaimsAsync(user);
            var Roles = await usermanager.GetRolesAsync(user);
            var RoleClaims = new List<Claim>();

            foreach (var role in Roles)
            {
                RoleClaims.Add(new Claim ("Roles", role));    
            }

            var Claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),      // Id For The Token
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("uid", user.Id)                                               // Id For The User
            }
            .Union(UserClaims).Union(RoleClaims);

            var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key));
            var SigningCredentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256);

            var jwtSecurityToken = new JwtSecurityToken(
                issuer: jwt.Issuer,
                audience: jwt.Audience,
                claims: Claims,           
                signingCredentials: SigningCredentials,
                expires: DateTime.Now.AddDays(jwt.DurationInDays)
            );

            return jwtSecurityToken;
        }
    }
}
