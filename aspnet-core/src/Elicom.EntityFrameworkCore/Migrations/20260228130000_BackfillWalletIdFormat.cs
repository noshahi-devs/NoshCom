using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Elicom.Migrations
{
    /// <inheritdoc />
    public partial class BackfillWalletIdFormat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @UserId bigint;
DECLARE @Name nvarchar(64);
DECLARE @Surname nvarchar(64);
DECLARE @UserName nvarchar(256);
DECLARE @Base nvarchar(256);
DECLARE @Clean nvarchar(32);
DECLARE @i int;
DECLARE @ch nchar(1);
DECLARE @candidate nvarchar(50);
DECLARE @digits int;

DECLARE user_cursor CURSOR FAST_FORWARD FOR
SELECT Id, Name, Surname, UserName
FROM AbpUsers
WHERE WalletId IS NULL
   OR (
        LEN(WalletId) = 36
        AND SUBSTRING(WalletId, 9, 1) = '-'
        AND SUBSTRING(WalletId, 14, 1) = '-'
        AND SUBSTRING(WalletId, 19, 1) = '-'
        AND SUBSTRING(WalletId, 24, 1) = '-'
      );

OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @UserId, @Name, @Surname, @UserName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Base = NULL;

    IF UPPER(ISNULL(@Name, '')) IN ('MUHAMMAD', 'MOHAMMAD', 'MUHAMAD', 'MUHAMMADU', 'MOHAMED', 'MUHAMED')
        AND ISNULL(LTRIM(RTRIM(@Surname)), '') <> ''
        SET @Base = @Surname;
    ELSE IF ISNULL(LTRIM(RTRIM(@Name)), '') <> ''
        SET @Base = @Name;
    ELSE IF ISNULL(LTRIM(RTRIM(@Surname)), '') <> ''
        SET @Base = @Surname;
    ELSE
        SET @Base = @UserName;

    SET @Clean = '';
    SET @i = 1;
    WHILE @i <= LEN(ISNULL(@Base, ''))
    BEGIN
        SET @ch = SUBSTRING(@Base, @i, 1);
        IF @ch LIKE '[A-Za-z0-9]'
            SET @Clean = @Clean + @ch;
        SET @i = @i + 1;
    END

    IF ISNULL(@Clean, '') = ''
        SET @Clean = 'USER';

    SET @Clean = UPPER(@Clean);
    IF LEN(@Clean) > 12
        SET @Clean = LEFT(@Clean, 12);

    SET @candidate = NULL;
    WHILE @candidate IS NULL
    BEGIN
        SET @digits = ABS(CHECKSUM(NEWID())) % 10000;
        SET @candidate = 'EF-' + @Clean + '-' + RIGHT('0000' + CAST(@digits as varchar(4)), 4);

        IF EXISTS (SELECT 1 FROM AbpUsers WHERE WalletId = @candidate)
            SET @candidate = NULL;
    END

    UPDATE AbpUsers SET WalletId = @candidate WHERE Id = @UserId;

    FETCH NEXT FROM user_cursor INTO @UserId, @Name, @Surname, @UserName;
END

CLOSE user_cursor;
DEALLOCATE user_cursor;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No rollback for data migration
        }
    }
}
