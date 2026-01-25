using Game_Library_Management_BL.DTO_s.RAWGDto;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class RAWGService : IRAWGService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;
        private readonly IUnitOfWork unitofwork;

        public RAWGService(HttpClient http, IConfiguration config, IUnitOfWork unitofwork)
        {
            _http = http;
            _config = config;
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<RAWGCatalogDto>> SearchGamesAsync(string query)
        {
            var key = _config["RAWG:ApiKey"];
            var url = $"https://api.rawg.io/api/games?key={key}&search={query}&page_size=20";

            var response = await _http.GetFromJsonAsync<RAWGResponseDto>(url);

            return response.Results.Select(g => new RAWGCatalogDto
            {
                ExternalId = g.Id,
                Title = g.Name,
                ImageUrl = g.Background_Image,
                Rating = g.Rating,
                ReleaseDate = g.Released
            });
        }
    }
}
