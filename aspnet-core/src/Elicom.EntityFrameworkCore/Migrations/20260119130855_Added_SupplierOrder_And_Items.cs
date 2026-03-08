using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class Added_SupplierOrder_And_Items : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "SupplierOrders");

            migrationBuilder.DropColumn(
                name: "SupplierTrackingNumber",
                table: "SupplierOrders");

            migrationBuilder.RenameColumn(
                name: "PurchasePrice",
                table: "SupplierOrders",
                newName: "TotalPurchaseAmount");

            migrationBuilder.AddColumn<long>(
                name: "ResellerId",
                table: "SupplierOrders",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "SupplierOrderItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupplierOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    PurchasePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierOrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupplierOrderItems_SupplierOrders_SupplierOrderId",
                        column: x => x.SupplierOrderId,
                        principalTable: "SupplierOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SupplierOrderItems_SupplierOrderId",
                table: "SupplierOrderItems",
                column: "SupplierOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SupplierOrderItems");

            migrationBuilder.DropColumn(
                name: "ResellerId",
                table: "SupplierOrders");

            migrationBuilder.RenameColumn(
                name: "TotalPurchaseAmount",
                table: "SupplierOrders",
                newName: "PurchasePrice");

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "SupplierOrders",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "SupplierTrackingNumber",
                table: "SupplierOrders",
                type: "nvarchar(max)",
                nullable: true);
        }
    }
}
