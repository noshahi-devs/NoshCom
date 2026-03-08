using System;
using System.Linq;
using System.Threading.Tasks;
using Elicom.Cards;
using Elicom.Cards.Dto;
using Elicom.GlobalPay;
using Elicom.GlobalPay.Dto;
using Elicom.Transactions;
using Elicom.Transactions.Dto;
using Elicom.Withdrawals;
using Elicom.Withdrawals.Dto;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Transactions
{
    public class TransactionAppService_Tests : ElicomTestBase
    {
        private readonly ITransactionAppService _transactionAppService;
        private readonly ICardAppService _cardAppService;
        private readonly IDepositRequestAppService _depositRequestAppService;
        private readonly IWithdrawAppService _withdrawAppService;

        public TransactionAppService_Tests()
        {
            _transactionAppService = Resolve<ITransactionAppService>();
            _cardAppService = Resolve<ICardAppService>();
            _depositRequestAppService = Resolve<IDepositRequestAppService>();
            _withdrawAppService = Resolve<IWithdrawAppService>();
        }

        [Fact]
        public async Task Should_Track_Full_Lifecycle_And_History()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            // 1. Create Card
            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });

            // 2. Deposit 1000
            var deposit = await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });
            await _depositRequestAppService.Approve(new ApproveDepositRequestInput { Id = deposit.Id });

            // 3. Withdraw 400
            var withdraw = await _withdrawAppService.SubmitWithdrawRequest(new CreateWithdrawRequestInput
            {
                Amount = 400,
                CardId = card.CardId,
                Method = "BankTransfer",
                PaymentDetails = "Acc: 123"
            });
            await _withdrawAppService.ApproveWithdraw(new ApproveWithdrawRequestInput { Id = withdraw.Id });

            // Act - Get Balance
            var balance = await _cardAppService.GetBalance();

            // Act - Get History
            var history = await _transactionAppService.GetHistory(new Abp.Application.Services.Dto.PagedAndSortedResultRequestDto());

            // Assert Balance
            balance.TotalBalance.ShouldBe(600);
            balance.PendingDeposit.ShouldBe(0);
            balance.PendingWithdrawal.ShouldBe(0);

            // Assert History
            history.TotalCount.ShouldBeGreaterThanOrEqualTo(2);
            history.Items.Any(t => t.Category == "Deposit" && t.Amount == 1000 && t.MovementType == "Credit").ShouldBeTrue();
            history.Items.Any(t => t.Category == "Withdrawal" && t.Amount == 400 && t.MovementType == "Debit").ShouldBeTrue();
        }

        [Fact]
        public async Task Should_Calculate_Pending_Amounts()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });

            // 1. Create pending deposit
            await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 500,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });

            // 2. Create pending withdrawal (after adding balance first)
            var deposit = await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });
            await _depositRequestAppService.Approve(new ApproveDepositRequestInput { Id = deposit.Id });
            
            await _withdrawAppService.SubmitWithdrawRequest(new CreateWithdrawRequestInput
            {
                Amount = 200,
                CardId = card.CardId,
                Method = "Crypto",
                PaymentDetails = "0xabc"
            });

            // Act
            var balance = await _cardAppService.GetBalance();

            // Assert
            balance.TotalBalance.ShouldBe(1000);
            balance.PendingDeposit.ShouldBe(500);
            balance.PendingWithdrawal.ShouldBe(200);
        }

        [Fact]
        public async Task Should_Return_Single_History_Row_For_Wallet_Backed_Card_Payment()
        {
            LoginAsTenant("easyfinora", "admin");

            var card = await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });
            var deposit = await _depositRequestAppService.Create(new CreateDepositRequestInput
            {
                Amount = 1000,
                CardId = card.CardId,
                Country = "Pakistan",
                Method = "P2P"
            });

            await _depositRequestAppService.Approve(new ApproveDepositRequestInput { Id = deposit.Id });

            const string referenceId = "CARD-PAYMENT-DEDUPE-001";

            await _cardAppService.ProcessPayment(new ProcessCardPaymentInput
            {
                CardNumber = card.CardNumber,
                Cvv = card.Cvv,
                ExpiryDate = card.ExpiryDate,
                Amount = 300,
                ReferenceId = referenceId,
                SourcePlatform = "WorldCart",
                Description = "WorldCart product purchase via Easy Finora Card"
            });

            var history = await _transactionAppService.GetHistory(new Abp.Application.Services.Dto.PagedAndSortedResultRequestDto
            {
                MaxResultCount = 50
            });

            history.Items.Count(t => t.ReferenceId == referenceId).ShouldBe(1);
            history.Items.Count(t =>
                t.ReferenceId == referenceId &&
                t.Category == "Card" &&
                t.Amount == 300 &&
                t.MovementType == "Debit").ShouldBe(1);
        }
    }
}
