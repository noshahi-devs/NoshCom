using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class Modified_SupplierOrder_And_Items : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupplierOrders_OrderId",
                table: "SupplierOrders");

            migrationBuilder.AlterColumn<Guid>(
                name: "OrderId",
                table: "SupplierOrders",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceCode",
                table: "SupplierOrders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplierOrders_OrderId",
                table: "SupplierOrders",
                column: "OrderId",
                unique: true,
                filter: "[OrderId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupplierOrders_OrderId",
                table: "SupplierOrders");

            migrationBuilder.DropColumn(
                name: "ReferenceCode",
                table: "SupplierOrders");

            migrationBuilder.AlterColumn<Guid>(
                name: "OrderId",
                table: "SupplierOrders",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplierOrders_OrderId",
                table: "SupplierOrders",
                column: "OrderId",
                unique: true);
        }
    }
}
