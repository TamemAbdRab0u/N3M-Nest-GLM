using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class AddIsTransprent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRectTransparent",
                table: "profiles",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRectTransparent",
                table: "profiles");
        }
    }
}
