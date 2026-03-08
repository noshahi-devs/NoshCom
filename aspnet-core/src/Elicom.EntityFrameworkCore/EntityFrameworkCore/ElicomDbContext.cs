using Abp.Zero.EntityFrameworkCore;
using Elicom.Authorization.Roles;
using Elicom.Authorization.Users;
using Elicom.Entities;
using Elicom.MultiTenancy;
using Microsoft.EntityFrameworkCore;

namespace Elicom.EntityFrameworkCore
{
    public class ElicomDbContext
        : AbpZeroDbContext<Tenant, Role, User, ElicomDbContext>
    {
        /* DbSets */
        public DbSet<Category> Categories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Store> Stores { get; set; }
        public DbSet<StoreKyc> StoreKycs { get; set; }
        public DbSet<StoreProduct> StoreProducts { get; set; }
        public DbSet<CustomerProfile> CustomerProfiles { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }

        public DbSet<Wallet> Wallets { get; set; }
        public DbSet<WalletTransaction> WalletTransactions { get; set; }
        public DbSet<SupplierOrder> SupplierOrders { get; set; }
        public DbSet<SupplierOrderItem> SupplierOrderItems { get; set; }
        public DbSet<DepositRequest> DepositRequests { get; set; }
        public DbSet<Cards.VirtualCard> VirtualCards { get; set; }
        public DbSet<Cards.CardApplication> CardApplications { get; set; }
        public DbSet<WithdrawRequest> WithdrawRequests { get; set; }
        public DbSet<AppTransaction> AppTransactions { get; set; }
        public DbSet<SupportTicket> SupportTickets { get; set; }
        public DbSet<Warehouse> Warehouses { get; set; }
        public DbSet<Carrier> Carriers { get; set; }
        public DbSet<SmartStoreWallet> SmartStoreWallets { get; set; }
        public DbSet<SmartStoreWalletTransaction> SmartStoreWalletTransactions { get; set; }

        public ElicomDbContext(DbContextOptions<ElicomDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            /* ---------------- Product ↔ Category ---------------- */
            builder.Entity<Product>(b =>
            {
                b.HasOne(p => p.Category)
                 .WithMany(c => c.Products)
                 .HasForeignKey(p => p.CategoryId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.Property(p => p.DiscountPercentage).HasColumnType("decimal(18,2)");
                b.Property(p => p.ResellerMaxPrice).HasColumnType("decimal(18,2)");
                b.Property(p => p.SupplierPrice).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Store ↔ User (Owner) ---------------- */
            builder.Entity<Store>(b =>
            {
                b.HasOne(s => s.Owner)
                 .WithMany() // one user can own multiple stores
                 .HasForeignKey(s => s.OwnerId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings
            });

            /* ---------------- Store ↔ StoreKyc (One-to-One) ---------------- */
            builder.Entity<StoreKyc>(b =>
            {
                b.HasOne(k => k.Store)
                 .WithOne(s => s.Kyc)
                 .HasForeignKey<StoreKyc>(k => k.StoreId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            /* ---------------- Store ↔ Product (Join Table) ---------------- */
            builder.Entity<StoreProduct>(b =>
            {
                b.HasOne(sp => sp.Store)
                 .WithMany(s => s.StoreProducts)
                 .HasForeignKey(sp => sp.StoreId)
                 .OnDelete(DeleteBehavior.Restrict);

                b.HasOne(sp => sp.Product)
                 .WithMany(p => p.StoreProducts)
                 .HasForeignKey(sp => sp.ProductId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.Property(sp => sp.ResellerDiscountPercentage).HasColumnType("decimal(18,2)");
                b.Property(sp => sp.ResellerPrice).HasColumnType("decimal(18,2)");

                // One product can be listed once per store
                b.HasIndex(sp => new { sp.StoreId, sp.ProductId }).IsUnique();
            });

            builder.Entity<CustomerProfile>(b =>
            {
                b.ToTable("CustomerProfiles");
                b.HasIndex(x => x.UserId).IsUnique();

                b.HasOne(x => x.User)
                 .WithMany()
                 .HasForeignKey(x => x.UserId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            /* ---------------- CartItem Configuration ---------------- */
            builder.Entity<CartItem>(b =>
            {
                b.ToTable("CartItems");

                // Relationship with User
                b.HasOne(c => c.User)
                 .WithMany() 
                 .HasForeignKey(c => c.UserId)
                 .OnDelete(DeleteBehavior.Cascade);

                // Relationship with StoreProduct
                b.HasOne(c => c.StoreProduct)
                 .WithMany()
                 .HasForeignKey(c => c.StoreProductId)
                 .OnDelete(DeleteBehavior.Restrict); // Prevent deleting a product if it's in someone's cart

                // Optional: Ensure precise decimals for currency
                b.Property(c => c.Price).HasColumnType("decimal(18,2)");
                b.Property(c => c.OriginalPrice).HasColumnType("decimal(18,2)");
                b.Property(c => c.ResellerDiscountPercentage).HasColumnType("decimal(18,2)");
            });


            // Re-pasting your existing CustomerProfile to ensure it stays intact
            builder.Entity<CustomerProfile>(b =>
            {
                b.ToTable("CustomerProfiles");
                b.HasIndex(x => x.UserId).IsUnique();

                b.HasOne(x => x.User)
                 .WithMany()
                 .HasForeignKey(x => x.UserId)
                 .OnDelete(DeleteBehavior.Cascade);
            });


            /* ---------------- Wallet Configuration ---------------- */
            builder.Entity<Wallet>(b =>
            {
                b.HasOne(w => w.User)
                 .WithOne()
                 .HasForeignKey<Wallet>(w => w.UserId)
                 .OnDelete(DeleteBehavior.Cascade);

                b.Property(w => w.Balance).HasColumnType("decimal(18,2)");
                b.Property(w => w.RowVersion).IsRowVersion();
            });

            builder.Entity<WalletTransaction>(b =>
            {
                b.HasOne(wt => wt.Wallet)
                 .WithMany()
                 .HasForeignKey(wt => wt.WalletId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.Property(wt => wt.Amount).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Order Configuration ---------------- */
            builder.Entity<Order>(b =>
            {
                b.HasOne(o => o.User)
                 .WithMany()
                 .HasForeignKey(o => o.UserId)
                 .OnDelete(DeleteBehavior.Restrict);

                b.Property(o => o.SubTotal).HasColumnType("decimal(18,2)");
                b.Property(o => o.TotalAmount).HasColumnType("decimal(18,2)");
                b.Property(o => o.ShippingCost).HasColumnType("decimal(18,2)");
                b.Property(o => o.Discount).HasColumnType("decimal(18,2)");
            });

            /* ---------------- OrderItem Configuration ---------------- */
            builder.Entity<OrderItem>(b =>
            {
                b.HasOne(oi => oi.Order)
                 .WithMany(o => o.OrderItems)
                 .HasForeignKey(oi => oi.OrderId)
                 .OnDelete(DeleteBehavior.Cascade)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.HasOne(oi => oi.StoreProduct)
                 .WithMany()
                 .HasForeignKey(oi => oi.StoreProductId)
                 .OnDelete(DeleteBehavior.Restrict);

                b.Property(oi => oi.DiscountPercentage).HasColumnType("decimal(18,2)");
                b.Property(oi => oi.OriginalPrice).HasColumnType("decimal(18,2)");
                b.Property(oi => oi.PriceAtPurchase).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Supplier Order Configuration ---------------- */
            builder.Entity<SupplierOrder>(b =>
            {
                b.Property(so => so.TotalPurchaseAmount).HasColumnType("decimal(18,2)");
            });

            builder.Entity<SupplierOrderItem>(b =>
            {
                b.HasOne(soi => soi.Product)
                 .WithMany()
                 .HasForeignKey(soi => soi.ProductId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.Property(soi => soi.PurchasePrice).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Request Entities ---------------- */
            builder.Entity<DepositRequest>(b =>
            {
                b.Property(dr => dr.Amount).HasColumnType("decimal(18,2)");
                b.Property(dr => dr.LocalAmount).HasColumnType("decimal(18,2)");
            });

            builder.Entity<WithdrawRequest>(b =>
            {
                b.Property(wr => wr.Amount).HasColumnType("decimal(18,2)");
            });

            builder.Entity<AppTransaction>(b =>
            {
                b.Property(at => at.Amount).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Card Entities ---------------- */
            builder.Entity<Cards.VirtualCard>(b =>
            {
                b.Property(vc => vc.Balance).HasColumnType("decimal(18,2)");
            });

            /* ---------------- Warehouse Configuration ---------------- */
            builder.Entity<Warehouse>(b =>
            {
                b.HasOne(w => w.Store)
                 .WithMany() // A store can have multiple warehouses
                 .HasForeignKey(w => w.StoreId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            /* ---------------- SmartStore Wallet Configuration ---------------- */
            builder.Entity<SmartStoreWallet>(b =>
            {
                b.HasOne(w => w.User)
                 .WithOne()
                 .HasForeignKey<SmartStoreWallet>(w => w.UserId)
                 .OnDelete(DeleteBehavior.Cascade);

                b.Property(w => w.Balance).HasColumnType("decimal(18,2)");
                b.Property(w => w.RowVersion).IsRowVersion();
            });

            builder.Entity<SmartStoreWalletTransaction>(b =>
            {
                b.HasOne(wt => wt.Wallet)
                 .WithMany()
                 .HasForeignKey(wt => wt.WalletId)
                 .OnDelete(DeleteBehavior.Restrict)
                 .IsRequired(false); // Make optional to avoid global query filter warnings

                b.Property(wt => wt.Amount).HasColumnType("decimal(18,2)");
            });
        }
    }
}
