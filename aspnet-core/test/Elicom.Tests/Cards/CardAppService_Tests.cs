using System.Linq;
using System.Threading.Tasks;
using Elicom.Cards;
using Elicom.Cards.Dto;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Cards
{
    public class CardAppService_Tests : ElicomTestBase
    {
        private readonly ICardAppService _cardAppService;

        public CardAppService_Tests()
        {
            _cardAppService = Resolve<ICardAppService>();
        }

        [Fact]
        public async Task Should_Create_Visa_Card()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateVirtualCardInput
            {
                CardType = CardType.Visa
            };

            // Act
            var result = await _cardAppService.CreateVirtualCard(input);

            // Assert
            result.ShouldNotBeNull();
            result.CardId.ShouldBeGreaterThan(0);
            result.CardType.ShouldBe(CardType.Visa);
            result.CardNumber.ShouldStartWith("4");
            result.CardNumber.Length.ShouldBe(19); // Formatted with spaces
            result.Cvv.Length.ShouldBe(3);
            result.Balance.ShouldBe(0);
            result.Currency.ShouldBe("USD");
            result.Status.ShouldBe("Active");
            result.HolderName.ShouldNotBeNullOrEmpty();
        }

        [Fact]
        public async Task Should_Create_MasterCard()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateVirtualCardInput
            {
                CardType = CardType.MasterCard
            };

            // Act
            var result = await _cardAppService.CreateVirtualCard(input);

            // Assert
            result.ShouldNotBeNull();
            result.CardType.ShouldBe(CardType.MasterCard);
            result.CardNumber.ShouldStartWith("5");
        }

        [Fact]
        public async Task Should_Create_Amex_Card()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateVirtualCardInput
            {
                CardType = CardType.Amex
            };

            // Act
            var result = await _cardAppService.CreateVirtualCard(input);

            // Assert
            result.ShouldNotBeNull();
            result.CardType.ShouldBe(CardType.Amex);
            result.CardNumber.ShouldStartWith("3");
        }

        [Fact]
        public async Task Should_Fail_With_Invalid_CardType()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateVirtualCardInput
            {
                CardType = (CardType)99 // Invalid enum value
            };

            // Act & Assert
            await Assert.ThrowsAsync<Abp.UI.UserFriendlyException>(async () =>
            {
                await _cardAppService.CreateVirtualCard(input);
            });
        }

        [Fact]
        public async Task Should_Generate_Unique_Card_Numbers()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateVirtualCardInput
            {
                CardType = CardType.Visa
            };

            // Act
            var card1 = await _cardAppService.CreateVirtualCard(input);
            var card2 = await _cardAppService.CreateVirtualCard(input);

            // Assert
            card1.CardNumber.ShouldNotBe(card2.CardNumber);
        }

        [Fact]
        public async Task Should_Get_User_Cards()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            // Create 2 cards
            await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.Visa });
            await _cardAppService.CreateVirtualCard(new CreateVirtualCardInput { CardType = CardType.MasterCard });

            // Act
            var result = await _cardAppService.GetUserCards();

            // Assert
            result.ShouldNotBeNull();
            result.Count.ShouldBeGreaterThanOrEqualTo(2);
            result.All(c => c.CardNumber.Contains("****")).ShouldBeTrue();
            result.All(c => c.Cvv == "***").ShouldBeTrue();
        }
    }
}
