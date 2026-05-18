using System;
using Elicom.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    [DbContext(typeof(ElicomDbContext))]
    [Migration("20260508000000_AddStoreFavorites")]
    public partial class AddStoreFavorites : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StoreFavorites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AdminUserId = table.Column<long>(type: "bigint", nullable: false),
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StoreFavorites_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoreFavorites_AdminUserId_StoreId",
                table: "StoreFavorites",
                columns: new[] { "AdminUserId", "StoreId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StoreFavorites_StoreId",
                table: "StoreFavorites",
                column: "StoreId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StoreFavorites");
        }
    }
}
