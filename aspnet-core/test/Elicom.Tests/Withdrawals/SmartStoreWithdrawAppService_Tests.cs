using System;
using System.Linq;
using System.Threading.Tasks;
using Abp.Domain.Repositories;
using Abp.Runtime.Session;
using Abp.UI;
using Elicom.Entities;
using Elicom.Wallets;
using Elicom.Withdrawals;
using Elicom.Withdrawals.Dto;
using Shouldly;
using Xunit;
using Microsoft.EntityFrameworkCore;

namespace Elicom.Tests.Withdrawals
{
    public class SmartStoreWithdrawAppService_Tests : ElicomTestBase
    {
        private readonly ISmartStoreWithdrawAppService _smartStoreWithdrawAppService;
        private readonly ISmartStoreWalletManager _smartStoreWalletManager;
        private readonly Xunit.Abstractions.ITestOutputHelper _output;

        public SmartStoreWithdrawAppService_Tests(Xunit.Abstractions.ITestOutputHelper output)
        {
            _smartStoreWithdrawAppService = Resolve<ISmartStoreWithdrawAppService>();
            _smartStoreWalletManager = Resolve<ISmartStoreWalletManager>();
            _output = output;
        }

        [Fact]
        public async Task Should_Fail_Withdrawal_Before_Allowed_Until()
        {
            _output.WriteLine("Starting Should_Fail_Withdrawal_Before_Allowed_Until");
            // Arrange
            LoginAsDefaultTenantAdmin(); // TenantId 1 is Smart Store
            var userId = AbpSession.GetUserId();
            await GrantPermissionAsync(userId, Elicom.Authorization.PermissionNames.Pages_SmartStore_Seller);

            // 1. Setup wallet with balance and a future allowed date
            await UsingDbContextAsync(async context =>
            {
                var wallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new SmartStoreWallet { UserId = userId, Balance = 1000 };
                    context.SmartStoreWallets.Add(wallet);
                }
                else
                {
                    wallet.Balance = 1000;
                }
                
                wallet.WithdrawLimit = 500;
                wallet.WithdrawAllowedUntil = DateTime.Now.AddDays(1); // One day in future
            });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 100,
                Method = "easyfinora",
                PaymentDetails = "EasyFinora Wallet ID: EF-TEST-123"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<UserFriendlyException>(async () =>
            {
                await _smartStoreWithdrawAppService.SubmitWithdrawRequest(input);
            });

            // The message should indicate the protocol is active (Wait Period)
            ex.Message.ShouldContain("Withdrawal protocol is still active");
        }

        [Fact]
        public async Task Should_Succeed_Withdrawal_After_Allowed_Until()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var userId = AbpSession.GetUserId();
            await GrantPermissionAsync(userId, Elicom.Authorization.PermissionNames.Pages_SmartStore_Seller);

            // 1. Setup wallet with balance and a past allowed date (Wait Period Over)
            await UsingDbContextAsync(async context =>
            {
                var wallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new SmartStoreWallet { UserId = userId, Balance = 1000 };
                    context.SmartStoreWallets.Add(wallet);
                }
                else
                {
                    wallet.Balance = 1000;
                }

                wallet.WithdrawLimit = 500;
                wallet.WithdrawAllowedUntil = DateTime.Now.AddDays(-1); // One day in past
            });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 100,
                Method = "bank",
                PaymentDetails = "Acc: PK123456789"
            };

            // Act
            var result = await _smartStoreWithdrawAppService.SubmitWithdrawRequest(input);

            // Assert
            result.ShouldNotBeNull();
            result.Amount.ShouldBe(100);
            result.Status.ShouldBe("Pending");
        }

        [Fact]
        public async Task Should_Succeed_Withdrawal_When_No_Wait_Date_Set()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var userId = AbpSession.GetUserId();
            await GrantPermissionAsync(userId, Elicom.Authorization.PermissionNames.Pages_SmartStore_Seller);

            await UsingDbContextAsync(async context =>
            {
                var wallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new SmartStoreWallet { UserId = userId, Balance = 1000 };
                    context.SmartStoreWallets.Add(wallet);
                }
                else
                {
                    wallet.Balance = 1000;
                    wallet.WithdrawAllowedUntil = null; // No wait period
                }

                wallet.WithdrawLimit = 500;
            });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 100,
                Method = "paypal",
                PaymentDetails = "test@example.com"
            };

            // Act
            var result = await _smartStoreWithdrawAppService.SubmitWithdrawRequest(input);

            // Assert
            result.ShouldNotBeNull();
            result.Amount.ShouldBe(100);
        }
        
        [Fact]
        public async Task Should_Fail_When_Amount_Exceeds_Admin_Withdraw_Limit()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var userId = AbpSession.GetUserId();
            await GrantPermissionAsync(userId, Elicom.Authorization.PermissionNames.Pages_SmartStore_Seller);

            await UsingDbContextAsync(async context =>
            {
                var wallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new SmartStoreWallet { UserId = userId, Balance = 1000 };
                    context.SmartStoreWallets.Add(wallet);
                }
                
                wallet.WithdrawLimit = 50; 
                wallet.WithdrawAllowedUntil = null;
            });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 100, // Exceeds limit of 50
                Method = "wise",
                PaymentDetails = "Wise ID: 999"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<UserFriendlyException>(async () =>
            {
                await _smartStoreWithdrawAppService.SubmitWithdrawRequest(input);
            });

            ex.Message.ShouldContain("withdrawal limit");
        }

        [Fact]
        public async Task Should_Deduct_Limit_After_Successful_Withdrawal()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var userId = AbpSession.GetUserId();
            await GrantPermissionAsync(userId, Elicom.Authorization.PermissionNames.Pages_SmartStore_Seller);

            var initialLimit = 500m;
            var withdrawAmount = 100m;

            // Ensure wallet exists with limit
            await UsingDbContextAsync(async context =>
            {
                var wallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new SmartStoreWallet { Id = Guid.NewGuid(), UserId = userId, Balance = 1000m, WithdrawLimit = initialLimit };
                    context.SmartStoreWallets.Add(wallet);
                }
                else
                {
                    wallet.Balance = 1000m;
                    wallet.WithdrawLimit = initialLimit;
                    wallet.WithdrawAllowedUntil = DateTime.Now.AddDays(-1); // Past
                }
            });

            // Act
            await _smartStoreWithdrawAppService.SubmitWithdrawRequest(new CreateWithdrawRequestInput
            {
                Amount = withdrawAmount,
                Method = "bank",
                PaymentDetails = "Test Details"
            });

            // Assert
            await UsingDbContextAsync(async context =>
            {
                var updatedWallet = await context.SmartStoreWallets.FirstOrDefaultAsync(w => w.UserId == userId);
                updatedWallet.WithdrawLimit.ShouldBe(initialLimit - withdrawAmount);
            });
        }
    }
}
