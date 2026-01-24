using Game_Library_Management_BL.DTO_s;
using Game_Library_Management_BL.DTO_s.TagsDto;
using Game_Library_Management_BL.Helper;
using Game_Library_Management_BL.Services.IServices;
using Game_Library_Management_BL.UnitOfWork;
using Game_Library_Management_DAL.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Services.Services
{
    public class GameService : IGameServices
    {
        private readonly IUnitOfWork unitofwork;
        private readonly UploadHandler uploadHandler;
        public GameService(IUnitOfWork unitofwork, UploadHandler uploadHandler)
        {
             this.unitofwork = unitofwork;
             this.uploadHandler = uploadHandler;
        }

        public async Task<IEnumerable<GameResponseDto>> AllGamesAsync()
        {
            var Games = await unitofwork.Games.Query()
                .Include(x => x.GameTags).ThenInclude(x => x.Tag)
                .Include(x => x.GamePlatforms).ThenInclude(x => x.Platform)
                .ToListAsync();

            return Games.Select(x => new GameResponseDto
            {
                Id = x.Id,
                Title = x.Title,
                Description = x.Description,
                ImgUrl = x.ImgUrl,
                ReleaseDate = x.ReleaseDate,
                Publisher = x.Publisher,
                Tags = x.GameTags.Select(x => new TagDto
                {
                    Name = x.Tag.Name
                }).ToList(),

                Platforms = x.GamePlatforms.Select(x => new PlatformDto
                {
                    Name = x.Platform.Name
                }).ToList()
            });
        }

        public async Task<GameResponseDto> GameByIdAsync(int Id)
        {
            var game = await unitofwork.Games.Query()
                .Include(x => x.GameTags).ThenInclude(x => x.Tag)
                .Include(x => x.GamePlatforms).ThenInclude(x => x.Platform)
                .FirstOrDefaultAsync(x => x.Id == Id);

            if (game == null)
                return null;

            return new GameResponseDto
            {
                Id = game.Id,
                Title = game.Title,
                Description = game.Description,
                ImgUrl = game.ImgUrl,
                ReleaseDate = game.ReleaseDate,
                Publisher = game.Publisher,
                Tags = game.GameTags.Select(x => new TagDto
                {
                    Name = x.Tag.Name
                }).ToList(),

                Platforms = game.GamePlatforms.Select(x => new PlatformDto
                {
                    Name = x.Platform.Name
                }).ToList()
            };
        }

        public async Task<GameResponseDto> CreateGameAsync(GameCreateDto game)
        {
            var UploadedFile = await uploadHandler.UploadAsync(game.ImageFile);

            var Game = new Game
            {
                Title =  game.Title,
                Description = game.Description,
                ImgUrl = UploadedFile,
                ReleaseDate = game.ReleaseDate,
                Publisher = game.Publisher
            };

            await unitofwork.Games.Add(Game);
            unitofwork.Save();

            return new GameResponseDto
            {
                Id = Game.Id,
                Title = Game.Title,
                Description = Game.Description,
                ImgUrl = Game.ImgUrl,
                ReleaseDate = Game.ReleaseDate,
                Publisher = Game.Publisher
            };
        }

        public async Task<GameResponseDto> UpdateGameAsync(int Id, GameUpdateDto game)
        {
            var UploadedFile = await uploadHandler.UploadAsync(game.ImageFile);
            var ExistedGame = await unitofwork.Games.GetById(Id);

            ExistedGame.Title = game.Title;
            ExistedGame.Description = game.Description;
            ExistedGame.ReleaseDate = game.ReleaseDate;
            ExistedGame.Publisher = game.Publisher;
            if (game.ImageFile != null)
            {
                var uploadedFile = await uploadHandler.UploadAsync(game.ImageFile);
                if (uploadedFile != null)
                    ExistedGame.ImgUrl = uploadedFile;
            }

            await unitofwork.Games.Update(ExistedGame);
            unitofwork.Save();

            return new GameResponseDto
            {
                Id = ExistedGame.Id,
                Title = ExistedGame.Title,
                Description = ExistedGame.Description,
                ImgUrl = ExistedGame.ImgUrl,
                ReleaseDate = ExistedGame.ReleaseDate,
                Publisher = ExistedGame.Publisher
            };
        }

        public async Task<GameResponseDto> PatchGameAsync(int Id, GameUpdateDto game)
        {
            var existingGame = await unitofwork.Games.GetById(Id);
            if (existingGame == null)
                return null;

            UpdateGameProperties(existingGame, game);

            if (game.ImageFile != null)
            {
                var uploadedFile = await uploadHandler.UploadAsync(game.ImageFile);
                if (uploadedFile != null)
                    existingGame.ImgUrl = uploadedFile;
            }

            await unitofwork.Games.Update(existingGame);
            unitofwork.Save();

            return new GameResponseDto
            {
                Id = existingGame.Id,
                Title = existingGame.Title,
                Description = existingGame.Description,
                ImgUrl = existingGame.ImgUrl,
                ReleaseDate = existingGame.ReleaseDate,
                Publisher = existingGame.Publisher
            };
        }

        private void UpdateGameProperties(Game existingGame, GameUpdateDto updateDto)
        {
            // Update Title only if provided
            if (!string.IsNullOrWhiteSpace(updateDto.Title))
                existingGame.Title = updateDto.Title;

            // Update Description only if provided
            if (!string.IsNullOrWhiteSpace(updateDto.Description))
                existingGame.Description = updateDto.Description;

            // Update ReleaseDate only if provided
            if (updateDto.ReleaseDate.HasValue)
                existingGame.ReleaseDate = updateDto.ReleaseDate.Value;

            // Update Publisher only if provided
            if (!string.IsNullOrWhiteSpace(updateDto.Publisher))
                existingGame.Publisher = updateDto.Publisher;
        }

        public async Task<bool> DeleteGameAsync(int Id)
        {
            var game = await unitofwork.Games.Delete(Id);
            unitofwork.Save();

            var deletedGame = await unitofwork.Games.GetById(Id);
            if(deletedGame != null)
                return false;

            return true;
        }

        // Tags Management //
        public async Task<bool> AddTagsToGameAsync(int gameId, List<int> tagIds)
        {
            var game = await unitofwork.Games.Query().Include(g => g.GameTags).FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null)
                return false;

            foreach (var tagId in tagIds)
            {
                game.GameTags.Add(new GameTag
                {
                    GameId = gameId,
                    TagId = tagId
                });
            }
            await unitofwork.Games.Update(game);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> ReplaceGameTagsAsync(int gameId, List<int> tagIds)
        {
            var game = await unitofwork.Games.Query().Include(g => g.GameTags).FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null)
                return false;

            foreach (var gt in game.GameTags.ToList())
            {
                unitofwork.GameTags.DeleteAsync(gt);
            }
            unitofwork.Save();

            foreach (var tagId in tagIds)
            {
                game.GameTags.Add(new GameTag
                {
                    GameId = gameId,
                    TagId = tagId
                });
            }
            await unitofwork.Games.Update(game);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> RemoveTagFromGameAsync(int gameId, int tagId)
        {
            var game = await unitofwork.GameTags.Query().FirstOrDefaultAsync(x => x.GameId == gameId && x.TagId == tagId);
            if(game == null)
                return false;

            await unitofwork.GameTags.DeleteAsync(game);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> RemoveTagFromGameAsync(int gameId)
        {
            var game = await unitofwork.Games.Query().Include(g => g.GameTags).FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null)
                return false;

            foreach(var gt in game.GameTags.ToList())
            {
                await unitofwork.GameTags.DeleteAsync(gt);
            }

            unitofwork.Save();
            return true;
        }

        // Platforms Management //
        public async Task<bool> AddPlatformsToGameAsync(int gameId, List<int> platformIds)
        {
            var game = await unitofwork.Games.Query().Include(x => x.GamePlatforms).FirstOrDefaultAsync(x => x.Id == gameId);
            if(game == null)
                return false;

            foreach(var plt in platformIds)
            {
                await unitofwork.GamePlatforms.Add(new GamePlatform
                {
                    GameId = gameId,
                    PlatformId = plt
                });
            }

            await unitofwork.Games.Update(game);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> RemovePlatformFromGameAsync(int gameId, int platfromId)
        {
            var game = await unitofwork.GamePlatforms.Query().FirstOrDefaultAsync(x => x.GameId == gameId && x.PlatformId == platfromId);
            if(game == null)
                return false;

            await unitofwork.GamePlatforms.DeleteAsync(game);
            unitofwork.Save();

            return true;
        }

        public async Task<bool> RemovePlatformsFromGameAsync(int gameId)
        {
            var game = await unitofwork.Games.Query().Include(x => x.GamePlatforms).FirstOrDefaultAsync(x => x.Id == gameId);
            if(game == null)
                return false;

            foreach(var plt in game.GamePlatforms.ToList())
            {
                await unitofwork.GamePlatforms.DeleteAsync(plt);
            }

            unitofwork.Save();
            return true;
        }

        
    }
}
