using Elicom.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Elicom.Migrations
{
    [DbContext(typeof(ElicomDbContext))]
    [Migration("20260306112500_Add_Withdrawal_Fields_To_SmartStoreWallets")]
    public class Add_Withdrawal_Fields_To_SmartStoreWallets : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('SmartStoreWallets', 'WithdrawLimit') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [WithdrawLimit] decimal(18,2) NULL;
END

IF COL_LENGTH('SmartStoreWallets', 'WithdrawAllowedUntil') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [WithdrawAllowedUntil] datetime2 NULL;
END

IF COL_LENGTH('SmartStoreWallets', 'AdminWithdrawRemarks') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [AdminWithdrawRemarks] nvarchar(max) NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('SmartStoreWallets', 'WithdrawLimit') IS NOT NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] DROP COLUMN [WithdrawLimit];
END

IF COL_LENGTH('SmartStoreWallets', 'WithdrawAllowedUntil') IS NOT NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] DROP COLUMN [WithdrawAllowedUntil];
END

IF COL_LENGTH('SmartStoreWallets', 'AdminWithdrawRemarks') IS NOT NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] DROP COLUMN [AdminWithdrawRemarks];
END
");
        }
    }
}
