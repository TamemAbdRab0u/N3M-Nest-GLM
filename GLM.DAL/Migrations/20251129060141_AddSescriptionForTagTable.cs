using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Game_Library_Management_DAL.Migrations
{
    /// <inheritdoc />
    public partial class AddSescriptionForTagTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "45f77757-ffd5-432b-a605-633d4b93d8d9");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "e6c42cb1-bf0f-437f-b89d-c8dbf44c193c");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Tags",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "5ec46a43-3f17-46ef-96cc-8f7490be0611", null, "Admin", "Admin" },
                    { "b0078a3b-708c-40aa-8fe8-973dc6b1150d", null, "User", "User" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "5ec46a43-3f17-46ef-96cc-8f7490be0611");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "b0078a3b-708c-40aa-8fe8-973dc6b1150d");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Tags");

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "45f77757-ffd5-432b-a605-633d4b93d8d9", null, "User", "User" },
                    { "e6c42cb1-bf0f-437f-b89d-c8dbf44c193c", null, "Admin", "Admin" }
                });
        }
    }
}
