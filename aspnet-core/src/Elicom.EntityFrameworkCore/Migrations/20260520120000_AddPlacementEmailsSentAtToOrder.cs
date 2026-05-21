using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Elicom.Migrations
{
    public partial class AddPlacementEmailsSentAtToOrder : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PlacementEmailsSentAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlacementEmailsSentAt",
                table: "Orders");
        }
    }
}
