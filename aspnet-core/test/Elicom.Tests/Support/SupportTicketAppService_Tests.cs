using System;
using System.Linq;
using System.Threading.Tasks;
using Elicom.Support;
using Elicom.Support.Dto;
using Shouldly;
using Xunit;

namespace Elicom.Tests.Support
{
    public class SupportTicketAppService_Tests : ElicomTestBase
    {
        private readonly ISupportTicketAppService _supportTicketAppService;

        public SupportTicketAppService_Tests()
        {
            _supportTicketAppService = Resolve<ISupportTicketAppService>();
        }

        [Fact]
        public async Task Should_Create_Support_Ticket()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();

            var input = new CreateSupportTicketInput
            {
                Title = "Help with card",
                Message = "I cannot see my card numbers",
                Priority = "High"
            };

            // Act
            var result = await _supportTicketAppService.Create(input);

            // Assert
            result.ShouldNotBeNull();
            result.Title.ShouldBe("Help with card");
            result.Status.ShouldBe("Open");
            result.Priority.ShouldBe("High");
        }

        [Fact]
        public async Task Should_Get_My_Tickets()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            await _supportTicketAppService.Create(new CreateSupportTicketInput { Title = "T1", Message = "M1" });

            // Act
            var result = await _supportTicketAppService.GetMyTickets(new Abp.Application.Services.Dto.PagedAndSortedResultRequestDto());

            // Assert
            result.TotalCount.ShouldBeGreaterThanOrEqualTo(1);
            result.Items.Any(t => t.Title == "T1").ShouldBeTrue();
        }

        [Fact]
        public async Task Should_Update_Ticket_Status_By_Admin()
        {
            // Arrange
            LoginAsDefaultTenantAdmin();
            var ticket = await _supportTicketAppService.Create(new CreateSupportTicketInput { Title = "T2", Message = "M2" });

            // Act
            await _supportTicketAppService.UpdateStatus(new UpdateSupportTicketStatusInput
            {
                Id = ticket.Id,
                Status = "Replied",
                AdminRemarks = "Check your email"
            });

            // Assert
            var result = await _supportTicketAppService.GetMyTickets(new Abp.Application.Services.Dto.PagedAndSortedResultRequestDto());
            var updatedTicket = result.Items.First(t => t.Id == ticket.Id);
            updatedTicket.Status.ShouldBe("Replied");
            updatedTicket.AdminRemarks.ShouldBe("Check your email");
        }
    }
}
