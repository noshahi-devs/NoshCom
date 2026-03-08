DECLARE @Email NVARCHAR(256) = 'engr.adeelnoshahi@gmail.com';
DECLARE @UserId BIGINT;

-- Get UserId
SELECT @UserId = Id
FROM AbpUsers
WHERE EmailAddress = @Email;

IF @UserId IS NULL
BEGIN
    PRINT 'User not found';
    RETURN;
END

BEGIN TRY
    BEGIN TRANSACTION;

    -------------------------------------------------
    -- 🔴 SMART STORE WALLET SECTION
    -------------------------------------------------

    -- 1️⃣ Delete SmartStoreWalletTransactions
    DELETE SST
    FROM SmartStoreWalletTransactions SST
    INNER JOIN SmartStoreWallets SSW ON SST.WalletId = SSW.Id
    WHERE SSW.UserId = @UserId;

    -- 2️⃣ Delete SmartStoreWallets
    DELETE FROM SmartStoreWallets
    WHERE UserId = @UserId;


    -------------------------------------------------
    -- 🔴 NORMAL WALLET SECTION
    -------------------------------------------------

    -- 3️⃣ Delete WalletTransactions
    DELETE WT
    FROM WalletTransactions WT
    INNER JOIN Wallets W ON WT.WalletId = W.Id
    WHERE W.UserId = @UserId;

    -- 4️⃣ Delete Wallets
    DELETE FROM Wallets
    WHERE UserId = @UserId;


    -------------------------------------------------
    -- 🔴 STORE SECTION
    -------------------------------------------------

    -- 5️⃣ Delete OrderItems
    DELETE OI
    FROM OrderItems OI
    INNER JOIN StoreProducts SP ON OI.StoreProductId = SP.Id
    INNER JOIN Stores S ON SP.StoreId = S.Id
    WHERE S.OwnerId = @UserId
       OR S.SupportEmail = @Email;

    -- 6️⃣ Delete CartItems
    DELETE CI
    FROM CartItems CI
    INNER JOIN StoreProducts SP ON CI.StoreProductId = SP.Id
    INNER JOIN Stores S ON SP.StoreId = S.Id
    WHERE S.OwnerId = @UserId
       OR S.SupportEmail = @Email;

    -- 7️⃣ Delete StoreProducts
    DELETE SP
    FROM StoreProducts SP
    INNER JOIN Stores S ON SP.StoreId = S.Id
    WHERE S.OwnerId = @UserId
       OR S.SupportEmail = @Email;

    -- 8️⃣ Delete Stores
    DELETE FROM Stores
    WHERE OwnerId = @UserId
       OR SupportEmail = @Email;


    -------------------------------------------------
    -- 🔴 OTHER USER DATA
    -------------------------------------------------

    -- 9️⃣ Delete SupportTickets
    DELETE FROM SupportTickets
    WHERE UserId = @UserId;

    -- 🔟 Delete UserRoles
    DELETE FROM AbpUserRoles
    WHERE UserId = @UserId;

    -- 1️⃣1️⃣ Finally Delete User
    DELETE FROM AbpUsers
    WHERE Id = @UserId;


    COMMIT TRANSACTION;

    PRINT 'User deleted successfully';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;

    PRINT 'Error occurred:';
    PRINT ERROR_MESSAGE();
END CATCH;