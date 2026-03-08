using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCardApplicationSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AbpUserLoginAttempts fix
            migrationBuilder.DropColumn(
                name: "FailReason",
                table: "AbpUserLoginAttempts");

            // Recreate CardApplications table to handle Identity -> Guid change cleanly
            migrationBuilder.DropTable(
                name: "CardApplications");

            migrationBuilder.CreateTable(
                name: "CardApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    CardType = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FullName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContactNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DocumentBase64 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AppliedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewedBy = table.Column<long>(type: "bigint", nullable: true),
                    ReviewedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    GeneratedCardId = table.Column<long>(type: "bigint", nullable: true),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorUserId = table.Column<long>(type: "bigint", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierUserId = table.Column<long>(type: "bigint", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeleterUserId = table.Column<long>(type: "bigint", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CardApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CardApplications_AbpUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AbpUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CardApplications_UserId",
                table: "CardApplications",
                column: "UserId");

            // Ensure AbpAuditLogs.Parameters is large enough for verbose logs
            migrationBuilder.AlterColumn<string>(
                name: "Parameters",
                table: "AbpAuditLogs",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CardApplications_AbpUsers_UserId",
                table: "CardApplications");

            migrationBuilder.DropIndex(
                name: "IX_CardApplications_UserId",
                table: "CardApplications");

            migrationBuilder.DropColumn(
                name: "AppliedDate",
                table: "CardApplications");

            migrationBuilder.DropColumn(
                name: "DocumentType",
                table: "CardApplications");

            migrationBuilder.DropColumn(
                name: "GeneratedCardId",
                table: "CardApplications");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "CardApplications");

            migrationBuilder.RenameColumn(
                name: "ReviewedDate",
                table: "CardApplications",
                newName: "DecisionDate");

            migrationBuilder.RenameColumn(
                name: "ReviewNotes",
                table: "CardApplications",
                newName: "AdminRemarks");

            migrationBuilder.AlterColumn<long>(
                name: "Id",
                table: "CardApplications",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddColumn<string>(
                name: "FailReason",
                table: "AbpUserLoginAttempts",
                type: "nvarchar(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Parameters",
                table: "AbpAuditLogs",
                type: "nvarchar(max)",
                maxLength: 4096,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1024)",
                oldMaxLength: 1024,
                oldNullable: true);
        }
    }
}
