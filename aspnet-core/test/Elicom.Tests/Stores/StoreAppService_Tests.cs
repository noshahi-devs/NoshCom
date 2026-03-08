using Elicom.Stores;
using Elicom.Stores.Dto;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using System;
using System.Threading.Tasks;
using Xunit;
using Elicom.Entities;
using Abp.Application.Services.Dto;
using Elicom.Authorization.Users;
using Abp.BackgroundJobs;
using Castle.MicroKernel.Registration;
using NSubstitute;
using Elicom.BackgroundJobs;
using System.Linq;

namespace Elicom.Tests.Stores
{
    public class StoreAppService_Tests : ElicomTestBase
    {
        private readonly IStoreAppService _storeAppService;
        private readonly IBackgroundJobManager _backgroundJobManager;

        public StoreAppService_Tests()
        {
            _backgroundJobManager = Substitute.For<IBackgroundJobManager>();
            LocalIocManager.IocContainer.Register(
                Component.For<IBackgroundJobManager>()
                    .Instance(_backgroundJobManager)
                    .LifestyleSingleton()
                    .IsDefault()
            );

            _storeAppService = Resolve<IStoreAppService>();
        }

        [Fact]
        public async Task Create_Store_Should_Queue_Application_Received_Email()
        {
            // Arrange
            long ownerId = 0;
            string ownerEmail = null;
            await UsingDbContextAsync(async context =>
            {
                var admin = await context.Users.FirstAsync(u => u.UserName == "admin" && u.TenantId == 1);
                ownerId = admin.Id;
                ownerEmail = admin.EmailAddress;
            });

            var input = new CreateStoreDto
            {
                Name = $"Email Queue Store {Guid.NewGuid():N}",
                OwnerId = ownerId,
                Slug = $"email-queue-store-{Guid.NewGuid():N}",
                Description = "Test store email queue",
                ShortDescription = "Test",
                LongDescription = "Test long description",
                SupportEmail = "store@test.com"
            };

            // Act
            using (var uow = LocalIocManager.Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin())
            {
                await _storeAppService.Create(input);
                await uow.CompleteAsync();
            }

            // Assert
            await _backgroundJobManager.Received(1).EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                Arg.Is<PlatformEmailJobArgs>(args =>
                    args != null &&
                    args.To == ownerEmail &&
                    args.Subject.Contains("We Received Your Store Application") &&
                    args.HtmlBody.Contains("Store Application Received") &&
                    args.HtmlBody.Contains("WORLD CART US")),
                Arg.Any<BackgroundJobPriority>(),
                Arg.Any<TimeSpan?>());
        }

        [Fact]
        public async Task Approve_Store_Test()
        {
            // Arrange
            Guid storeId = Guid.NewGuid();
            await UsingDbContextAsync(async context =>
            {
                var admin = await context.Users.FirstAsync(u => u.UserName == "admin");
                
                context.Stores.Add(new Store
                {
                    Id = storeId,
                    Name = "Test Store",
                    OwnerId = admin.Id,
                    Status = false,
                    SupportEmail = "store@test.com",
                    Slug = "test-store",
                    Description = "Test Description",
                    ShortDescription = "Short",
                    LongDescription = "Long"
                });
            });

            // Act
            using (var uow = LocalIocManager.Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin())
            {
                await _storeAppService.Approve(new EntityDto<Guid>(storeId));
                await uow.CompleteAsync();
            }

            // Assert
            await UsingDbContextAsync(async context =>
            {
                var store = await context.Stores.FirstOrDefaultAsync(s => s.Id == storeId);
                store.ShouldNotBeNull();
                store.Status.ShouldBeTrue();
            });

            await _backgroundJobManager.Received(1).EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                Arg.Is<PlatformEmailJobArgs>(args =>
                    args != null &&
                    args.Subject.Contains("Approved") &&
                    args.HtmlBody.Contains("Store Application Approved")),
                Arg.Any<BackgroundJobPriority>(),
                Arg.Any<TimeSpan?>());
        }

        [Fact]
        public async Task Reject_Store_Test()
        {
            // Arrange
            Guid storeId = Guid.NewGuid();
            await UsingDbContextAsync(async context =>
            {
                var admin = await context.Users.FirstAsync(u => u.UserName == "admin");

                context.Stores.Add(new Store
                {
                    Id = storeId,
                    Name = "Rejected Store",
                    OwnerId = admin.Id,
                    Status = true, // Start as true
                    SupportEmail = "reject@test.com",
                    Slug = "reject-store",
                    Description = "Test Description",
                    ShortDescription = "Short",
                    LongDescription = "Long"
                });
            });

            // Act
            using (var uow = LocalIocManager.Resolve<Abp.Domain.Uow.IUnitOfWorkManager>().Begin())
            {
                await _storeAppService.Reject(new RejectStoreInput
                {
                    Id = storeId,
                    Reason = "<script>alert('x')</script> Missing documents"
                });
                await uow.CompleteAsync();
            }

            // Assert
            await UsingDbContextAsync(async context =>
            {
                var store = await context.Stores.FirstOrDefaultAsync(s => s.Id == storeId);
                store.ShouldNotBeNull();
                store.Status.ShouldBeFalse();
            });

            await _backgroundJobManager.Received(1).EnqueueAsync<PlatformEmailJob, PlatformEmailJobArgs>(
                Arg.Is<PlatformEmailJobArgs>(args =>
                    args != null &&
                    args.Subject.Contains("Not Approved") &&
                    args.HtmlBody.Contains("Store Application Update") &&
                    args.HtmlBody.Contains("Reason:") &&
                    args.HtmlBody.Contains("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; Missing documents") &&
                    !args.HtmlBody.Contains("<script>alert('x')</script>")),
                Arg.Any<BackgroundJobPriority>(),
                Arg.Any<TimeSpan?>());
        }
    }
}
