
using Game_Library_Management.Helpers;
using Game_Library_Management.Hubs;
using Game_Library_Management_BL.Helper;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.Services.Services;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Data;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Reflection;
using System.Security.Claims;

namespace Game_Library_Management
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddMemoryCache();
            builder.Services.AddSwaggerGen(setupAction =>
            {
                var xmlCommentsFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
                var xmlCommentsFullPath = Path.Combine(AppContext.BaseDirectory, xmlCommentsFile);

                setupAction.IncludeXmlComments(xmlCommentsFullPath);
            });


            #region Registration
            builder.Services.Configure<Jwt>(builder.Configuration.GetSection("JWT"));
            builder.Services.AddIdentity<ApplicationUser, IdentityRole>().AddEntityFrameworkStores<AppDbContext>();
            builder.Services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlServer(builder.Configuration.GetConnectionString("constr"), 
                    o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
            });
            builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();
            builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
            builder.Services.AddScoped<UploadHandler>();
            builder.Services.AddScoped<IGameServices, GameService>();
            builder.Services.AddScoped<ITagServices, TagServices>();
            builder.Services.AddScoped<IPlatformservices, PlatformServices>();
            builder.Services.AddScoped<IUserGamesServices, UserGamesServices>();
            builder.Services.AddScoped<IStatsService, StatsService>();
            builder.Services.AddScoped<IProfileService, ProfileService>();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddHttpClient<IGameCatalogService, GameCatalogService>();
            builder.Services.AddHttpClient<ISteamService, SteamService>();
            builder.Services.AddScoped<IReviewServices,ReviewServices>();
            builder.Services.AddScoped<IFriendshipService, FriendshipService>();
            builder.Services.AddScoped<ICollectionServices, CollectionServices>();

            builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, NotificationUserIdProvider>();
            builder.Services.AddSingleton<IOnlineUserTracker, OnlineUserTracker>();

            builder.Services.AddSignalR();
            #endregion

            #region CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.SetIsOriginAllowed(origin => true) // Allow any origin for development
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });
            });
            #endregion

            #region JWT Authentication

            builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            }).AddJwtBearer(o =>
            {
                o.RequireHttpsMetadata = false;
                o.SaveToken = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidIssuer = builder.Configuration["JWT:Issuer"],
                    ValidAudience = builder.Configuration["JWT:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(builder.Configuration["JWT:Key"])),
                    ClockSkew = TimeSpan.Zero
                };
 
                o.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) &&
                            (path.StartsWithSegments("/chat") || path.StartsWithSegments("/notifications")))
                        {
                            context.Token = accessToken;
                        }
                        return System.Threading.Tasks.Task.CompletedTask;
                    }
                };
            });
 
            #endregion

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            // Comment out HTTPS redirection for development
            // app.UseHttpsRedirection();

            app.UseStaticFiles(); // Serve files from wwwroot
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads")),
                RequestPath = "/Uploads"
            });

            // Serve the frontend files
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
                    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../GLM.FrontEnd"))),
                RequestPath = "/GLM.FrontEnd"
            });

            app.UseCors("AllowFrontend");

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<ChatHub>("/chat");
            app.MapHub<NotificationHub>("/notifications");

            app.Run();
        }
    }
}
