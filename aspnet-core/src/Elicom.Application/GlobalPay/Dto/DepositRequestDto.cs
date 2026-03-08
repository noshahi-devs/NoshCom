using Abp.Application.Services.Dto;
using System;

namespace Elicom.GlobalPay.Dto
{
    public class DepositRequestDto : EntityDto<Guid>
    {
        public long UserId { get; set; }
        public string UserName { get; set; }
        public string FullName { get; set; }
        public string Name { get; set; }
        public string Surname { get; set; }
        public decimal? LocalAmount { get; set; }
        public string LocalCurrency { get; set; }
        public long? CardId { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; }
        public string Country { get; set; }
        public string DestinationAccount { get; set; }
        public string ProofImage { get; set; }
        public bool HasProof { get; set; }
        public string Status { get; set; }
        public string Method { get; set; }
        public string SourcePlatform { get; set; }
        public string AdminRemarks { get; set; }
        public DateTime CreationTime { get; set; }
        public string ReferenceId { get; set; }
    }

    public class CreateDepositRequestInput
    {
        public long? CardId { get; set; }
        public decimal Amount { get; set; }
        public decimal? LocalAmount { get; set; }
        public string LocalCurrency { get; set; }
        public string Country { get; set; }
        public string Method { get; set; } // P2P, Crypto
        public string ProofImage { get; set; } // Base64 or URL after upload
        public string ReferenceId { get; set; } // Transaction / Payment reference ID
    }

    public class ApproveDepositRequestInput
    {
        public Guid Id { get; set; }
        public string AdminRemarks { get; set; }
    }
}
