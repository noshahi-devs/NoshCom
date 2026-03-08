using System;

namespace Elicom.Cards.Dto
{
    public class RejectApplicationInput
    {
        public Guid Id { get; set; }
        public string AdminRemarks { get; set; } // Required for rejection
    }
}
