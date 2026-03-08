using System.Collections.Generic;
using System.Threading.Tasks;
using Abp.Application.Services;
using Elicom.Cards.Dto;

namespace Elicom.Cards
{
    public interface ICardAppService : IApplicationService
    {
        Task<VirtualCardDto> CreateVirtualCard(CreateVirtualCardInput input);

        Task<List<VirtualCardDto>> GetUserCards();
        Task<VirtualCardDto> GetCardSensitiveDetails(long cardId);

        Task<UserBalanceDto> GetBalance();

        Task<CardValidationResultDto> ValidateCard(ValidateCardInput input);

        Task ProcessPayment(ProcessCardPaymentInput input);
        Task<PurchaseUpgradePlanResultDto> PurchaseUpgradePlan(PurchaseUpgradePlanInput input);
        Task<PurchaseUpgradePlanResultDto> ApplyUpgradePlan(ApplyUpgradePlanInput input);
        Task<CardUsageOverviewDto> GetCardUsageOverview(long cardId);
        // Card Application Methods
        Task<CardApplicationDto> SubmitCardApplication(SubmitCardApplicationInput input);

        Task<List<CardApplicationDto>> GetMyApplications();

        Task<List<CardApplicationDto>> GetPendingApplications(); // Admin only

        Task<VirtualCardDto> ApproveCardApplication(ApproveApplicationInput input); // Admin only

        Task RejectCardApplication(RejectApplicationInput input); // Admin only

        Task<string> GetApplicationDocument(System.Guid id);
        
        Task RefundPayment(long userId, decimal amount, string referenceId, string description);
    }

    public class ValidateCardInput
    {
        public string CardNumber { get; set; }
        public string ExpiryDate { get; set; }
        public string Cvv { get; set; }
        public decimal Amount { get; set; }
        public string SourcePlatform { get; set; }
    }

    public class CardValidationResultDto
    {
        public bool IsValid { get; set; }
        public string Message { get; set; }
        public decimal AvailableBalance { get; set; }
    }

    public class ProcessCardPaymentInput : ValidateCardInput
    {
        public string ReferenceId { get; set; } // Order ID
        public string Description { get; set; }
    }

    public class PurchaseUpgradePlanInput
    {
        public string PlanCode { get; set; }
        public string CardNumber { get; set; }
        public string ExpiryDate { get; set; }
        public string Cvv { get; set; }
        public string HolderName { get; set; }
    }

    public class ApplyUpgradePlanInput
    {
        public string PlanCode { get; set; }
    }

    public class PurchaseUpgradePlanResultDto
    {
        public string PlanName { get; set; }
        public string PlanCode { get; set; }
        public decimal AmountCharged { get; set; }
        public long CardId { get; set; }
        public string CardNumber { get; set; }
        public string CardStatus { get; set; }
        public decimal RemainingWalletBalance { get; set; }
        public string ActiveSubscriptionCode { get; set; }
        public string ActiveSubscription { get; set; }
        public string PendingSubscriptionCode { get; set; }
        public string PendingSubscription { get; set; }
        public string Message { get; set; }
    }
}
