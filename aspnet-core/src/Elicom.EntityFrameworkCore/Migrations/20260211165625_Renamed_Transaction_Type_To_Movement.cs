using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class Renamed_Transaction_Type_To_Movement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems");

            migrationBuilder.RenameColumn(
                name: "TransactionType",
                table: "WalletTransactions",
                newName: "MovementType");

            migrationBuilder.RenameColumn(
                name: "TransactionType",
                table: "SmartStoreWalletTransactions",
                newName: "MovementType");

            migrationBuilder.RenameColumn(
                name: "TransactionType",
                table: "AppTransactions",
                newName: "MovementType");

            // Data conversion for VirtualCards.CardType
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = '0' WHERE CardType = 'Visa'");
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = '1' WHERE CardType = 'MasterCard'");
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = '2' WHERE CardType = 'Amex'");
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = '0' WHERE CardType IS NULL OR CardType NOT IN ('0', '1', '2')");

            migrationBuilder.AlterColumn<int>(
                name: "CardType",
                table: "VirtualCards",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems");

            migrationBuilder.RenameColumn(
                name: "MovementType",
                table: "WalletTransactions",
                newName: "TransactionType");

            migrationBuilder.RenameColumn(
                name: "MovementType",
                table: "SmartStoreWalletTransactions",
                newName: "TransactionType");

            migrationBuilder.RenameColumn(
                name: "MovementType",
                table: "AppTransactions",
                newName: "TransactionType");

            migrationBuilder.AlterColumn<string>(
                name: "CardType",
                table: "VirtualCards",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // Reverse mapping for VirtualCards.CardType
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = 'Visa' WHERE CardType = '0'");
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = 'MasterCard' WHERE CardType = '1'");
            migrationBuilder.Sql("UPDATE VirtualCards SET CardType = '2' WHERE CardType = 'Amex'");

            migrationBuilder.AddForeignKey(
                name: "FK_SupplierOrderItems_Products_ProductId",
                table: "SupplierOrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
