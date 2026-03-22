USE [NoshcomDb_Testing];
GO

DECLARE @Email NVARCHAR(256) = LTRIM(RTRIM('engr.adeelnoshahi@gmail.com'));
DECLARE @UserId BIGINT;

-------------------------------------------------
-- Get UserId
-------------------------------------------------
SELECT TOP 1 @UserId = Id
FROM dbo.AbpUsers
WHERE LTRIM(RTRIM(LOWER(EmailAddress))) = LOWER(@Email);

IF @UserId IS NULL
BEGIN
    PRINT 'User not found';
    RETURN;
END

PRINT 'User Found. UserId = ' + CAST(@UserId AS NVARCHAR);

BEGIN TRY
BEGIN TRANSACTION;

-------------------------------------------------
-- SUPPLIER ORDERS (child of Orders)
-------------------------------------------------

DELETE FROM dbo.SupplierOrders
WHERE OrderId IN (
    SELECT Id FROM dbo.Orders WHERE UserId = @UserId
);

-------------------------------------------------
-- ORDER ITEMS
-------------------------------------------------

DELETE FROM dbo.OrderItems
WHERE OrderId IN (
    SELECT Id FROM dbo.Orders WHERE UserId = @UserId
);

-------------------------------------------------
-- CART ITEMS
-------------------------------------------------

DELETE FROM dbo.CartItems
WHERE UserId = @UserId;

-------------------------------------------------
-- ORDERS
-------------------------------------------------

DELETE FROM dbo.Orders
WHERE UserId = @UserId;

-------------------------------------------------
-- STORE PRODUCTS
-------------------------------------------------

DELETE FROM dbo.StoreProducts
WHERE StoreId IN (
    SELECT Id FROM dbo.Stores
    WHERE OwnerId = @UserId OR SupportEmail = @Email
);

-------------------------------------------------
-- STORES
-------------------------------------------------

DELETE FROM dbo.Stores
WHERE OwnerId = @UserId OR SupportEmail = @Email;

-------------------------------------------------
-- SMART STORE WALLET
-------------------------------------------------

DELETE FROM dbo.SmartStoreWalletTransactions
WHERE WalletId IN (
    SELECT Id FROM dbo.SmartStoreWallets WHERE UserId = @UserId
);

DELETE FROM dbo.SmartStoreWallets
WHERE UserId = @UserId;

-------------------------------------------------
-- NORMAL WALLET
-------------------------------------------------

DELETE FROM dbo.WalletTransactions
WHERE WalletId IN (
    SELECT Id FROM dbo.Wallets WHERE UserId = @UserId
);

DELETE FROM dbo.Wallets
WHERE UserId = @UserId;

-------------------------------------------------
-- SUPPORT TICKETS
-------------------------------------------------

DELETE FROM dbo.SupportTickets
WHERE UserId = @UserId;

-------------------------------------------------
-- USER ROLES
-------------------------------------------------

DELETE FROM dbo.AbpUserRoles
WHERE UserId = @UserId;

-------------------------------------------------
-- FINAL USER DELETE
-------------------------------------------------

DELETE FROM dbo.AbpUsers
WHERE Id = @UserId;

COMMIT TRANSACTION;

PRINT 'User and all related data deleted successfully';

END TRY
BEGIN CATCH

ROLLBACK TRANSACTION;

PRINT 'ERROR OCCURRED:';
PRINT ERROR_MESSAGE();

END CATCH;