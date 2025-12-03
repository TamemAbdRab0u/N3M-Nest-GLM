using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class ReCreatingUsertables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "126df1d2-bf97-48c8-bbfe-a53cd941e09e");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "42c65660-75e4-4160-a8be-40b1d8df165f");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "126df1d2-bf97-48c8-bbfe-a53cd941e09e", null, "Admin", "Admin" },
                    { "42c65660-75e4-4160-a8be-40b1d8df165f", null, "User", "User" }
                });
        }
    }
}
