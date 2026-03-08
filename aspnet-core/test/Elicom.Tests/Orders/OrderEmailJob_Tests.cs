using Elicom.Entities;
using Elicom.Orders.BackgroundJobs;
using Elicom.BackgroundJobs;
using Shouldly;
using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Microsoft.EntityFrameworkCore;
using Abp.Net.Mail;
using NSubstitute;
using Castle.MicroKernel.Registration;
using System.Collections.Generic;

namespace Elicom.Tests.Orders
{
    public class OrderEmailJob_Tests : ElicomTestBase
    {
        private readonly OrderEmailJob _job;
        private readonly IEmailSender _emailSender;

        public OrderEmailJob_Tests()
        {
            // Substitute IEmailSender to verify calls
            _emailSender = Substitute.For<IEmailSender>();
            LocalIocManager.IocContainer.Register(
                Component.For<IEmailSender>().Instance(_emailSender).LifestyleSingleton().IsDefault()
            );

            _job = Resolve<OrderEmailJob>();
        }

        [Fact]
        public async Task Should_Send_Emails_When_Job_Executed()
        {
            // Arrange
            Guid orderId = Guid.Empty;
            string customerEmail = "";

            UsingDbContext(context =>
            {
                var user = context.Users.First();
                customerEmail = user.EmailAddress;

                var category = new Category { Name = "TestJobCat", Slug = "testjobcat", Status = true };
                context.Categories.Add(category);
                context.SaveChanges();

                var store = new Store { Name = "TestJob Store", OwnerId = user.Id, Status = true, Slug = "testjobstore" };
                context.Stores.Add(store);
                context.SaveChanges();

                var product = new Product { Name = "TestJob Product", CategoryId = category.Id, SupplierPrice = 10, StockQuantity = 100, Status = true };
                context.Products.Add(product);
                context.SaveChanges();

                var storeProduct = new StoreProduct { StoreId = store.Id, ProductId = product.Id, ResellerPrice = 20, Status = true, StockQuantity = 100 };
                context.StoreProducts.Add(storeProduct);
                context.SaveChanges();

                var order = new Order
                {
                    UserId = user.Id,
                    OrderNumber = "ORD-JOB-TEST",
                    TotalAmount = 20,
                    Status = "Pending",
                    RecipientEmail = customerEmail,
                    OrderItems = new List<OrderItem>
                    {
                        new OrderItem { StoreProductId = storeProduct.Id, ProductId = product.Id, Quantity = 1, PriceAtPurchase = 20, ProductName = "TestJob Product", StoreName = "TestJob Store" }
                    }
                };
                context.Orders.Add(order);
                context.SaveChanges();
                orderId = order.Id;
            });

            // Act
            await _job.ExecuteAsync(new OrderEmailJobArgs { OrderId = orderId });

            // Assert
            // 1. Customer email
            await _emailSender.Received().SendAsync(Arg.Is<System.Net.Mail.MailMessage>(m => m.To.Any(t => t.Address == customerEmail)));
            
            // 2. Admin email
            await _emailSender.Received().SendAsync(Arg.Is<System.Net.Mail.MailMessage>(m => m.Subject.Contains("[ALERT] New Order")));
            
            // 3. Seller email
            await _emailSender.Received().SendAsync(Arg.Is<System.Net.Mail.MailMessage>(m => m.Subject.Contains("New Sale:")));
        }
    }
}
