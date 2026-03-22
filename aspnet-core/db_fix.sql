USE [NoshcomDb_Testing];
GO

-- 1. Stores table ke liye
IF COL_LENGTH('Stores', 'IsAdminActive') IS NULL
BEGIN
    ALTER TABLE [Stores] ADD [IsAdminActive] bit NOT NULL CONSTRAINT [DF_Stores_IsAdminActive] DEFAULT(1);
END
GO

-- 2. SmartStoreWallets table ke liye
IF COL_LENGTH('SmartStoreWallets', 'WithdrawLimit') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [WithdrawLimit] decimal(18,2) NULL;
END
GO

IF COL_LENGTH('SmartStoreWallets', 'WithdrawAllowedUntil') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [WithdrawAllowedUntil] datetime2 NULL;
END
GO

IF COL_LENGTH('SmartStoreWallets', 'AdminWithdrawRemarks') IS NULL
BEGIN
    ALTER TABLE [SmartStoreWallets] ADD [AdminWithdrawRemarks] nvarchar(max) NULL;
END
GO
