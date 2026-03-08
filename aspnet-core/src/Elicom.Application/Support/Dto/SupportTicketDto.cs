using Abp.Application.Services.Dto;
using System;

namespace Elicom.Support.Dto
{
    public class SupportTicketDto : FullAuditedEntityDto<Guid>
    {
        public long? UserId { get; set; }
        public string UserName { get; set; }
        public string Title { get; set; }
        public string Message { get; set; }
        public string Priority { get; set; }
        public string Status { get; set; }
        public string AdminRemarks { get; set; }
        public string ContactEmail { get; set; }
        public string ContactName { get; set; }
    }

    public class CreateSupportTicketInput
    {
        public string Title { get; set; }
        public string Message { get; set; }
        public string Priority { get; set; }
        public string ContactEmail { get; set; }
        public string ContactName { get; set; }
    }

    public class UpdateSupportTicketStatusInput
    {
        public Guid Id { get; set; }
        public string Status { get; set; }
        public string AdminRemarks { get; set; }
    }
}
