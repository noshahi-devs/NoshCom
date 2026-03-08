using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class MakeProductAndCategoryMultiTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Products",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Categories",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplierOrderItems_ProductId",
                table: "SupplierOrderItems",
                column: "ProductId");

            migrationBuilder.Sql("DELETE FROM SupplierOrderItems WHERE ProductId NOT IN (SELECT Id FROM Products)");

            migrationBuilder.AddForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_SupplierOrderItems_ProductId",
                table: "SupplierOrderItems");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Categories");
        }
    }
}
