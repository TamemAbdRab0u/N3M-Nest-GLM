using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class Favourite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "d76c3fce-14a5-47bf-96e6-389d4467e085");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "ef6d06e8-1300-47d7-be2d-324ddae3d38e");

            migrationBuilder.AddColumn<bool>(
                name: "IsFavorite",
                table: "UserGames",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "27f1261c-6f18-430e-89b6-3abbfbca2626", null, "Admin", "Admin" },
                    { "3790d42f-75f3-464f-b13b-8795cfdda824", null, "User", "User" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "27f1261c-6f18-430e-89b6-3abbfbca2626");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "3790d42f-75f3-464f-b13b-8795cfdda824");

            migrationBuilder.DropColumn(
                name: "IsFavorite",
                table: "UserGames");

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "d76c3fce-14a5-47bf-96e6-389d4467e085", null, "Admin", "Admin" },
                    { "ef6d06e8-1300-47d7-be2d-324ddae3d38e", null, "User", "User" }
                });
        }
    }
}
