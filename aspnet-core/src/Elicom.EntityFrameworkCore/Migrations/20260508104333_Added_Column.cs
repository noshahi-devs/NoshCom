using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class Added_Column : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ServiceCharge",
                table: "Orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WarehouseCharge",
                table: "Orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServiceCharge",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "WarehouseCharge",
                table: "Orders");
        }
    }
}
