using Abp.Application.Services.Dto;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Elicom.Stores.Dto
{
    public class StoreDto : EntityDto<Guid>
    {
        public string Name { get; set; }
        public long OwnerId { get; set; }
        public string ShortDescription { get; set; }
        public string LongDescription { get; set; }
        public string Description { get; set; }
        public string Slug { get; set; }
        public string SupportEmail { get; set; }
        public bool Status { get; set; }
        public bool IsActive { get; set; }
        public bool IsAdminActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public decimal? WithdrawLimit { get; set; }
        public DateTime? WithdrawAllowedUntil { get; set; }
        public string AdminWithdrawRemarks { get; set; }
        public decimal WalletBalance { get; set; }
        public int TotalOrders { get; set; }
        public int ShippedOrders { get; set; }
        public StoreKycDto Kyc { get; set; }
    }

    public class StoreKycDto : EntityDto<Guid>
    {
        public Guid StoreId { get; set; }
        public string FullName { get; set; }
        public string CNIC { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string IssueCountry { get; set; }
        public DateTime? DOB { get; set; }
        public string Phone { get; set; }
        public string Address { get; set; }
        public string ZipCode { get; set; }
        public string FrontImage { get; set; }
        public string BackImage { get; set; }
        public bool Status { get; set; }
    }

    public class UpdateWithdrawPermissionInput
    {
        public Guid StoreId { get; set; }
        public decimal? WithdrawLimit { get; set; }
        public DateTime? WithdrawAllowedUntil { get; set; }
        public string AdminWithdrawRemarks { get; set; }
    }
}
