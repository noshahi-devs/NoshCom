using Abp.Application.Services;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using AutoMapper;
using Elicom.Entities;
using Elicom.Carts.Dto;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.Transactions;

namespace Elicom.Carts
{
    public class CartAppService : ApplicationService, ICartAppService
    {
        private readonly IRepository<CartItem, Guid> _cartRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;

        public CartAppService(
            IRepository<CartItem, Guid> cartRepository,
            IRepository<StoreProduct, Guid> storeProductRepository)
        {
            _cartRepository = cartRepository;
            _storeProductRepository = storeProductRepository;
        }

        public virtual async Task<CartItemDto> AddToCart(CreateCartItemDto input)
        {
            // Keep soft-delete filter ON so deleted cart rows are not reused.
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                // 1. Check if item already exists in cart for this user
                var existingItem = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Store)
                    .FirstOrDefaultAsync(c => c.UserId == input.UserId && 
                                              c.StoreProductId == input.StoreProductId && 
                                              c.Status == "Active");

                if (existingItem != null)
                {
                    Logger.Info($"[CartAppService] Updating existing cart item: {existingItem.Id}, new quantity={existingItem.Quantity + input.Quantity}");
                    existingItem.Quantity += input.Quantity;

                    // Refresh snapshot prices in case they were changed or were 0
                    if (existingItem.StoreProduct != null)
                    {
                        var sp = existingItem.StoreProduct;
                        existingItem.OriginalPrice = sp.ResellerPrice;
                        existingItem.ResellerDiscountPercentage = sp.ResellerDiscountPercentage;
                        existingItem.Price = sp.ResellerPrice * (1 - sp.ResellerDiscountPercentage / 100m);
                    }

                    await _cartRepository.UpdateAsync(existingItem);
                    return ObjectMapper.Map<CartItemDto>(existingItem);
                }

                Logger.Info($"[CartAppService] Adding new item to cart: UserId={input.UserId}, StoreProductId={input.StoreProductId}");

                // 2. Fetch StoreProduct
                var storeProduct = await _storeProductRepository
                    .GetAllIncluding(sp => sp.Product, sp => sp.Store)
                    .FirstOrDefaultAsync(sp => sp.Id == input.StoreProductId);

                if (storeProduct == null) 
                {
                    Logger.Error($"[CartAppService] StoreProduct {input.StoreProductId} NOT FOUND even with filters disabled.");
                    throw new Abp.UI.UserFriendlyException("Store product not found.");
                }

                Logger.Info($"[CartAppService] StoreProduct found: {storeProduct.Product.Name} from store {storeProduct.Store.Name}");

                // 3. Create new CartItem
                var cartItem = ObjectMapper.Map<CartItem>(input);
                cartItem.Status = "Active";

                // Snapshot prices
                cartItem.OriginalPrice = storeProduct.ResellerPrice;
                cartItem.ResellerDiscountPercentage = storeProduct.ResellerDiscountPercentage;
                cartItem.Price = storeProduct.ResellerPrice * (1 - storeProduct.ResellerDiscountPercentage / 100m);

                var id = await _cartRepository.InsertAndGetIdAsync(cartItem);
                
                // Re-fetch with includes to ensure DTO is fully populated
                var finalItem = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Store)
                    .FirstOrDefaultAsync(c => c.Id == id);

                return ObjectMapper.Map<CartItemDto>(finalItem);
            }
        }

        public virtual async Task<List<CartItemDto>> GetCartItems(long userId)
        {
            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var items = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct)
                        .ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct)
                        .ThenInclude(sp => sp.Store)
                    .Where(c => c.UserId == userId && c.Status == "Active")
                    .ToListAsync();

                return ObjectMapper.Map<List<CartItemDto>>(items);
            }
        }

        public virtual async Task RemoveFromCart(Guid cartItemId)
        {
            await _cartRepository.DeleteAsync(cartItemId);
        }

        [HttpDelete]
        public virtual async Task RemoveFromCartByProduct(long userId, Guid storeProductId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var item = await _cartRepository.GetAll()
                    .FirstOrDefaultAsync(c => c.UserId == userId && c.StoreProductId == storeProductId && c.Status == "Active");

                if (item != null)
                {
                    await _cartRepository.DeleteAsync(item);
                }
            }
        }

        [HttpDelete]
        public virtual async Task ClearCart(long userId)
        {
            using (UnitOfWorkManager.Current.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var items = await _cartRepository.GetAllListAsync(c => c.UserId == userId);

                foreach (var item in items)
                {
                    await _cartRepository.DeleteAsync(item);
                }
            }
        }
    }
}
