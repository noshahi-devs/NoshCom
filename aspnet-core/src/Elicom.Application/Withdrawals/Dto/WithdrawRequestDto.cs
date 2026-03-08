using Abp.Application.Services.Dto;
using System;

namespace Elicom.Withdrawals.Dto
{
    public class WithdrawRequestDto : EntityDto<long>
    {
        public long UserId { get; set; }
        public string UserName { get; set; }
        public long CardId { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; }
        public string Method { get; set; }
        public string PaymentDetails { get; set; }
        public string Status { get; set; }
        public string AdminRemarks { get; set; }
        public decimal LocalAmount { get; set; }
        public string LocalCurrency { get; set; }
        public string PaymentProof { get; set; }
        public bool HasProof { get; set; }
        public decimal ServiceFee { get; set; }
        public decimal NetAmount { get; set; }
        public DateTime CreationTime { get; set; }
    }

    public class CreateWithdrawRequestInput
    {
        public long CardId { get; set; }
        public decimal Amount { get; set; }
        public string Method { get; set; }
        public string PaymentDetails { get; set; }
        public decimal LocalAmount { get; set; }
        public string LocalCurrency { get; set; }
    }

    public class ApproveWithdrawRequestInput
    {
        public long Id { get; set; }
        public string AdminRemarks { get; set; }
        public string PaymentProof { get; set; }
    }

    public class WithdrawalEligibilityDto
    {
        public bool IsEligible { get; set; }
        public string Message { get; set; }
        public int DaysRemaining { get; set; }
        public int HoursRemaining { get; set; }
        public int MinutesRemaining { get; set; }
        public string NextEligibleDate { get; set; }
    }
}
