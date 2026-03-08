using Elicom.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Elicom.Migrations
{
    [DbContext(typeof(ElicomDbContext))]
    [Migration("20260306101500_Add_IsAdminActive_To_Stores")]
    public class Add_IsAdminActive_To_Stores : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Stores', 'IsAdminActive') IS NULL
BEGIN
    ALTER TABLE [Stores]
    ADD [IsAdminActive] bit NOT NULL
        CONSTRAINT [DF_Stores_IsAdminActive] DEFAULT(1);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Stores', 'IsAdminActive') IS NOT NULL
BEGIN
    DECLARE @constraintName nvarchar(128);

    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'Stores' AND c.name = 'IsAdminActive';

    IF @constraintName IS NOT NULL
        EXEC('ALTER TABLE [Stores] DROP CONSTRAINT [' + @constraintName + ']');

    ALTER TABLE [Stores] DROP COLUMN [IsAdminActive];
END
");
        }
    }
}

