using System.Linq;
using System.Threading.Tasks;
using Elicom.Cards;
using Elicom.Cards.Dto;
using Elicom.GlobalPay;
using Elicom.GlobalPay.Dto;
using Elicom.Withdrawals;
using Elicom.Withdrawals.Dto;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Withdrawals
{
    public class WithdrawAppService_Tests : ElicomTestBase
    {
        private readonly IWithdrawAppService _withdrawAppService;
        private readonly ICardAppService _cardAppService;
        private readonly IDepositRequestAppService _depositRequestAppService;

        public WithdrawAppService_Tests()
        {
            _withdrawAppService = Resolve<IWithdrawAppService>();
            _cardAppService = Resolve<ICardAppService>();
            _depositRequestAppService = Resolve<IDepositRequestAppService>();
        }

        [Fact]
        public async Task Should_Submit_Withdraw_Request()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            // 1. Create a card and add balance via deposit
            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });
            var deposit = await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });
            await _depositRequestAppService.Approve(new ApproveDepositRequestInput { Id = deposit.Id });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 200,
                CardId = card.CardId,
                Method = "BankTransfer",
                PaymentDetails = "Acc: 123456789"
            };

            // Act
            var result = await _withdrawAppService.SubmitWithdrawRequest(input);

            // Assert
            result.ShouldNotBeNull();
            result.Amount.ShouldBe(200);
            result.Status.ShouldBe("Pending");
        }

        [Fact]
        public async Task Should_Fail_With_Insufficient_Balance()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });

            var input = new CreateWithdrawRequestInput
            {
                Amount = 500, // Card balance is 0
                CardId = card.CardId,
                Method = "Crypto",
                PaymentDetails = "Wallet: 0xabc"
            };

            // Act & Assert
            await Assert.ThrowsAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _withdrawAppService.SubmitWithdrawRequest(input);
            });
        }

        [Fact]
        public async Task Should_Deduct_Balance_On_Approval()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            // 1. Setup card with 1000 balance
            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });
            var deposit = await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });
            await _depositRequestAppService.Approve(new ApproveDepositRequestInput { Id = deposit.Id });

            // 2. Submit withdrawal of 300
            var withdraw = await _withdrawAppService.SubmitWithdrawRequest(new CreateWithdrawRequestInput
            {
                Amount = 300,
                CardId = card.CardId,
                Method = "BankTransfer",
                PaymentDetails = "Acc: 123"
            });

            // 3. Approve withdrawal
            await _withdrawAppService.ApproveWithdraw(new ApproveWithdrawRequestInput
            {
                Id = withdraw.Id,
                AdminRemarks = "Withdrawal OK"
            });

            // Act
            var cards = await _cardAppService.GetUserCards();
            var updatedCard = cards.First(c => c.CardId == card.CardId);

            // Assert
            updatedCard.Balance.ShouldBe(700);
        }
    }
}
