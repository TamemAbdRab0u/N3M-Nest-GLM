using Game_Library_Management_BL.DTO_s.GamesDto_s;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class GameServices : IGameServices
    {
        private readonly IUnitOfWork unitofwork;
        public GameServices(IUnitOfWork unitofwork)
        {
            this.unitofwork = unitofwork;
        }

        public async Task<IEnumerable<GameResponseDto>> AllGamesAsync()
        {
            var games = await unitofwork.Games.Query().ToListAsync();
            return games.Select(x => new GameResponseDto
            {
                Id = x.Id,
                Title = x.Title,
                Description = x.Description,
                ImgUrl = x.ImgUrl,
                ReleaseDate = x.ReleaseDate,
                Publisher = x.Publisher
            });
        }

        public async Task<GameResponseDto> GameByIdAsync(int Id)
        {
            var game = await unitofwork.Games.Query().FirstOrDefaultAsync(x => x.Id == Id);
            return new GameResponseDto
            {
                Id = game.Id,
                Title = game.Title,
                Description = game.Description,
                ImgUrl = game.ImgUrl,
                ReleaseDate = game.ReleaseDate,
                Publisher = game.Publisher
            };
        }

        public async Task<GameResponseDto> AddGameAsync(CreateGameDto game)
        {
            var Game = new Game
            {
                Title = game.Title,
                Description = game.Description,
                ImgUrl = game.ImgUrl,
                ReleaseDate = game.ReleaseDate,
                Publisher = game.Publisher
            };

            var CreatedGame = await unitofwork.Games.Add(Game);
            unitofwork.Save();
            return new GameResponseDto
            {
                Id = CreatedGame.Id,
                Title = CreatedGame.Title,
                Description = CreatedGame.Description,
                ImgUrl = CreatedGame.ImgUrl,
                ReleaseDate = CreatedGame.ReleaseDate,
                Publisher = CreatedGame.Publisher
            };
        }

        public async Task<GameResponseDto> UpdateGameAsync(UpdateGameDto game)
        {
            var Game = new Game
            {
                Title = game.Title,
                Description = game.Description,
                ImgUrl = game.ImgUrl,
                ReleaseDate = game.ReleaseDate,
                Publisher = game.Publisher
            };

            var UpdatedGame = await unitofwork.Games.Update(Game);
            unitofwork.Save();
            return new GameResponseDto
            {
                Id = UpdatedGame.Id,
                Title = UpdatedGame.Title,
                Description = UpdatedGame.Description,
                ImgUrl = UpdatedGame.ImgUrl,
                ReleaseDate = UpdatedGame.ReleaseDate,
                Publisher = UpdatedGame.Publisher
            };
        }

        public Task<bool> RemoveGameAsync(int Id)
        {
            var GameToRemove = unitofwork.Games.GetById(Id);
            if (GameToRemove == null)
            {
                return Task.FromResult(false);
            }

            else
            {
                unitofwork.Games.Delete(Id);
                unitofwork.Save();
                return Task.FromResult(true);
            }
        }

        
    }
}
