using System;

namespace Elicom.Cards.Dto
{
    public class ApproveApplicationInput
    {
        public Guid Id { get; set; }
        public string AdminRemarks { get; set; } // Optional
    }
}
