using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class AddNumberOfAchivmentsAndTrailerUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AchievementsCount",
                table: "Games",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrailerPreview",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrailerUrl",
                table: "Games",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AchievementsCount",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "TrailerPreview",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "TrailerUrl",
                table: "Games");
        }
    }
}
