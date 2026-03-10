using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class AddingNewPropertiesAndTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Tags",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Tags",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Platforms",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Platforms",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundImageUrl",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DetailsLastSyncedAt",
                table: "Games",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EsrbRating",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDetailsHydrated",
                table: "Games",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Metacritic",
                table: "Games",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MinimumRequirements",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Playtime",
                table: "Games",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Rating",
                table: "Games",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RatingTop",
                table: "Games",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RatingsCount",
                table: "Games",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecommendedRequirements",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Developers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Developers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameScreenshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameScreenshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameScreenshots_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GameTrailers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    VideoUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PreviewImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameTrailers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameTrailers_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PublisherEntities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PublisherEntities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameDevelopers",
                columns: table => new
                {
                    GameId = table.Column<int>(type: "int", nullable: false),
                    DeveloperId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameDevelopers", x => new { x.GameId, x.DeveloperId });
                    table.ForeignKey(
                        name: "FK_GameDevelopers_Developers_DeveloperId",
                        column: x => x.DeveloperId,
                        principalTable: "Developers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GameDevelopers_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GamePublishers",
                columns: table => new
                {
                    GameId = table.Column<int>(type: "int", nullable: false),
                    PublisherEntityId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GamePublishers", x => new { x.GameId, x.PublisherEntityId });
                    table.ForeignKey(
                        name: "FK_GamePublishers_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GamePublishers_PublisherEntities_PublisherEntityId",
                        column: x => x.PublisherEntityId,
                        principalTable: "PublisherEntities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tags_Name",
                table: "Tags",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Platforms_Name",
                table: "Platforms",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Developers_Name",
                table: "Developers",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GameDevelopers_DeveloperId",
                table: "GameDevelopers",
                column: "DeveloperId");

            migrationBuilder.CreateIndex(
                name: "IX_GamePublishers_PublisherEntityId",
                table: "GamePublishers",
                column: "PublisherEntityId");

            migrationBuilder.CreateIndex(
                name: "IX_GameScreenshots_GameId",
                table: "GameScreenshots",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_GameTrailers_GameId",
                table: "GameTrailers",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_PublisherEntities_Name",
                table: "PublisherEntities",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameDevelopers");

            migrationBuilder.DropTable(
                name: "GamePublishers");

            migrationBuilder.DropTable(
                name: "GameScreenshots");

            migrationBuilder.DropTable(
                name: "GameTrailers");

            migrationBuilder.DropTable(
                name: "Developers");

            migrationBuilder.DropTable(
                name: "PublisherEntities");

            migrationBuilder.DropIndex(
                name: "IX_Tags_Name",
                table: "Tags");

            migrationBuilder.DropIndex(
                name: "IX_Platforms_Name",
                table: "Platforms");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Tags");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Platforms");

            migrationBuilder.DropColumn(
                name: "BackgroundImageUrl",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "DetailsLastSyncedAt",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "EsrbRating",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "IsDetailsHydrated",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Metacritic",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "MinimumRequirements",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Playtime",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Rating",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "RatingTop",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "RatingsCount",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "RecommendedRequirements",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "Games");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Tags",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Platforms",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }
    }
}
