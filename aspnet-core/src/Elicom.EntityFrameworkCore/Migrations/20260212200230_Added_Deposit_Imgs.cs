using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class Added_Deposit_Imgs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LocalAmount",
                table: "WithdrawRequests",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "LocalCurrency",
                table: "WithdrawRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentProof",
                table: "WithdrawRequests",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LocalAmount",
                table: "WithdrawRequests");

            migrationBuilder.DropColumn(
                name: "LocalCurrency",
                table: "WithdrawRequests");

            migrationBuilder.DropColumn(
                name: "PaymentProof",
                table: "WithdrawRequests");
        }
    }
}
