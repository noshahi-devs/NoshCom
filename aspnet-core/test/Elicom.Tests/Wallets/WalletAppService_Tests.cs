using Elicom.Wallets;
using Elicom.Wallets.Dto;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Abp.UI;

namespace Elicom.Tests.Wallets
{
    public class WalletAppService_Tests : ElicomTestBase
    {
        private readonly IWalletAppService _walletAppService;

        public WalletAppService_Tests()
        {
            _walletAppService = Resolve<IWalletAppService>();
        }

        [Fact]
        public async Task Should_Auto_Create_Wallet_On_Get()
        {
            // Act
            var wallet = await _walletAppService.GetMyWallet();

            // Assert
            wallet.ShouldNotBeNull();
            wallet.Balance.ShouldBe(0);
            wallet.Currency.ShouldBe("PKR");
        }

        [Fact]
        public async Task Should_Deposit_Funds()
        {
            // Act
            await _walletAppService.Deposit(new DepositInput
            {
                Amount = 1000,
                Method = "JazzCash"
            });

            var wallet = await _walletAppService.GetMyWallet();

            // Assert
            wallet.Balance.ShouldBe(1000);
        }

        [Fact]
        public async Task Should_Accumulate_Balance()
        {
            // Act
            await _walletAppService.Deposit(new DepositInput { Amount = 500, Method = "EasyPaisa" });
            await _walletAppService.Deposit(new DepositInput { Amount = 200, Method = "JazzCash" });

            var wallet = await _walletAppService.GetMyWallet();

            // Assert
            wallet.Balance.ShouldBe(700);
        }

        [Fact]
        public async Task Should_Transfer_Funds_By_Recipient_Wallet_Id()
        {
            LoginAsTenant("easyfinora", "admin");

            const string recipientWalletId = "recipient-wallet-01";

            UsingDbContext(3, context =>
            {
                var sender = context.Users.IgnoreQueryFilters()
                    .First(u => u.TenantId == 3 && u.UserName == "admin");
                var recipient = context.Users.IgnoreQueryFilters()
                    .First(u => u.TenantId == 3 && u.UserName == "GP_noshahi@easyfinora.com");

                sender.WalletId = "sender-wallet-01";
                recipient.WalletId = recipientWalletId;
            });

            await _walletAppService.Deposit(new DepositInput
            {
                Amount = 1000,
                Method = "Test"
            });

            await _walletAppService.Transfer(new TransferInput
            {
                Amount = 250,
                RecipientWalletId = recipientWalletId,
                Description = "Wallet ID transfer"
            });

            UsingDbContext(3, context =>
            {
                var sender = context.Users.IgnoreQueryFilters()
                    .First(u => u.TenantId == 3 && u.UserName == "admin");
                var recipient = context.Users.IgnoreQueryFilters()
                    .First(u => u.TenantId == 3 && u.UserName == "GP_noshahi@easyfinora.com");

                var senderWallet = context.Wallets.First(w => w.UserId == sender.Id);
                var recipientWallet = context.Wallets.First(w => w.UserId == recipient.Id);

                senderWallet.Balance.ShouldBe(750);
                recipientWallet.Balance.ShouldBe(250);
            });
        }

        [Fact]
        public async Task Should_Throw_For_Transfer_When_Balance_Is_Insufficient()
        {
            LoginAsTenant("easyfinora", "admin");

            const string recipientWalletId = "recipient-wallet-low-balance";

            UsingDbContext(3, context =>
            {
                var recipient = context.Users.IgnoreQueryFilters()
                    .First(u => u.TenantId == 3 && u.UserName == "GP_noshahi@easyfinora.com");

                recipient.WalletId = recipientWalletId;
            });

            var ex = await Assert.ThrowsAsync<UserFriendlyException>(() => _walletAppService.Transfer(new TransferInput
            {
                Amount = 250,
                RecipientWalletId = recipientWalletId,
                Description = "Should fail"
            }));

            ex.Message.ShouldBe("Insufficient balance in your wallet.");
        }
    }
}
