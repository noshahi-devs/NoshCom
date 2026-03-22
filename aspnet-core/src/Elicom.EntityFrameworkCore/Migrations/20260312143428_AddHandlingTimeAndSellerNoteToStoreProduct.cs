using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class AddHandlingTimeAndSellerNoteToStoreProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HandlingTime",
                table: "StoreProducts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SellerNote",
                table: "StoreProducts",
                type: "nvarchar(max)",
                nullable: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HandlingTime",
                table: "StoreProducts");

            migrationBuilder.DropColumn(
                name: "SellerNote",
                table: "StoreProducts");

        }
    }
}
