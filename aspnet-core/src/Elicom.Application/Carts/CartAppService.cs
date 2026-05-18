using Abp.Application.Services;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using Elicom.Authorization.Users;
using Elicom.Carts.Dto;
using Elicom.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elicom.Carts
{
    [AbpAuthorize]
    public class CartAppService : ApplicationService, ICartAppService
    {
        private readonly IRepository<CartItem, Guid> _cartRepository;
        private readonly IRepository<StoreProduct, Guid> _storeProductRepository;
        private readonly IRepository<User, long> _userRepository;

        public CartAppService(
            IRepository<CartItem, Guid> cartRepository,
            IRepository<StoreProduct, Guid> storeProductRepository,
            IRepository<User, long> userRepository)
        {
            _cartRepository = cartRepository;
            _storeProductRepository = storeProductRepository;
            _userRepository = userRepository;
        }

        public virtual async Task<CartItemDto> AddToCart(CreateCartItemDto input)
        {
            if (input == null)
            {
                throw new Abp.UI.UserFriendlyException("Invalid cart request.");
            }

            var effectiveUserId = await ResolveEffectiveUserIdAsync(input.UserId);

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var existingItem = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Store)
                    .FirstOrDefaultAsync(c => c.UserId == effectiveUserId &&
                                              c.StoreProductId == input.StoreProductId &&
                                              c.Status == "Active");

                if (existingItem != null)
                {
                    Logger.Info($"[CartAppService] Updating existing cart item: {existingItem.Id}, new quantity={existingItem.Quantity + input.Quantity}");
                    existingItem.Quantity += input.Quantity;

                    if (existingItem.Quantity <= 0)
                    {
                        await _cartRepository.DeleteAsync(existingItem);
                        return ObjectMapper.Map<CartItemDto>(existingItem);
                    }

                    await _cartRepository.UpdateAsync(existingItem);
                    return ObjectMapper.Map<CartItemDto>(existingItem);
                }

                if (input.Quantity <= 0)
                {
                    return new CartItemDto(); // Cannot add negative quantity for new items
                }

                Logger.Info($"[CartAppService] Adding new item to cart: UserId={effectiveUserId}, StoreProductId={input.StoreProductId}");

                var storeProduct = await _storeProductRepository
                    .GetAllIncluding(sp => sp.Product, sp => sp.Store)
                    .FirstOrDefaultAsync(sp => sp.Id == input.StoreProductId);

                if (storeProduct == null)
                {
                    Logger.Error($"[CartAppService] StoreProduct {input.StoreProductId} NOT FOUND even with filters disabled.");
                    throw new Abp.UI.UserFriendlyException("Store product not found.");
                }

                Logger.Info($"[CartAppService] StoreProduct found: {storeProduct.Product.Name} from store {storeProduct.Store.Name}");

                var cartItem = ObjectMapper.Map<CartItem>(input);
                cartItem.UserId = effectiveUserId;
                cartItem.TenantId = AbpSession.TenantId;
                cartItem.Status = "Active";

                cartItem.OriginalPrice = storeProduct.ResellerPrice;
                cartItem.ResellerDiscountPercentage = storeProduct.ResellerDiscountPercentage;
                cartItem.Price = storeProduct.ResellerPrice * (1 - storeProduct.ResellerDiscountPercentage / 100m);

                var id = await _cartRepository.InsertAndGetIdAsync(cartItem);

                var finalItem = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct).ThenInclude(sp => sp.Store)
                    .FirstOrDefaultAsync(c => c.Id == id);

                return ObjectMapper.Map<CartItemDto>(finalItem);
            }
        }

        public virtual async Task<List<CartItemDto>> GetCartItems(long userId)
        {
            var effectiveUserId = await ResolveEffectiveUserIdAsync(userId);

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var items = await _cartRepository.GetAll()
                    .Include(c => c.StoreProduct)
                        .ThenInclude(sp => sp.Product)
                    .Include(c => c.StoreProduct)
                        .ThenInclude(sp => sp.Store)
                    .Where(c => c.UserId == effectiveUserId && c.Status == "Active")
                    .ToListAsync();

                return ObjectMapper.Map<List<CartItemDto>>(items);
            }
        }

        public virtual async Task RemoveFromCart(Guid cartItemId)
        {
            var currentUserId = AbpSession.UserId ?? 0;
            if (currentUserId <= 0)
            {
                throw new AbpAuthorizationException("Current user did not login to the application!");
            }

            var item = await _cartRepository.FirstOrDefaultAsync(cartItemId);
            if (item == null)
            {
                return;
            }

            if (item.UserId != currentUserId)
            {
                throw new AbpAuthorizationException("You are not allowed to remove this cart item.");
            }

            await _cartRepository.DeleteAsync(item);
        }

        [HttpDelete]
        public virtual async Task RemoveFromCartByProduct(long userId, Guid storeProductId)
        {
            var effectiveUserId = await ResolveEffectiveUserIdAsync(userId);

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var item = await _cartRepository.GetAll()
                    .FirstOrDefaultAsync(c => c.UserId == effectiveUserId && c.StoreProductId == storeProductId && c.Status == "Active");

                if (item != null)
                {
                    await _cartRepository.DeleteAsync(item);
                }
            }
        }

        [HttpDelete]
        public virtual async Task ClearCart(long userId)
        {
            var effectiveUserId = await ResolveEffectiveUserIdAsync(userId);

            using (CurrentUnitOfWork.DisableFilter(AbpDataFilters.MayHaveTenant, AbpDataFilters.MustHaveTenant))
            {
                var items = await _cartRepository.GetAllListAsync(c => c.UserId == effectiveUserId && c.Status == "Active");

                foreach (var item in items)
                {
                    await _cartRepository.DeleteAsync(item);
                }
            }
        }

        private async Task<long> ResolveEffectiveUserIdAsync(long? requestedUserId)
        {
            var currentUserId = AbpSession.UserId ?? 0;

            if (requestedUserId.HasValue && requestedUserId.Value > 0 && requestedUserId.Value != currentUserId)
            {
                Logger.Warn($"[CartAppService] Ignoring mismatched requested userId={requestedUserId.Value}. Using session userId={currentUserId}.");
            }

            if (currentUserId <= 0)
            {
                throw new AbpAuthorizationException("Current user did not login to the application!");
            }

            var userExists = await _userRepository.GetAll().AnyAsync(u => u.Id == currentUserId);
            if (!userExists)
            {
                throw new AbpAuthorizationException("User session is invalid. Please login again.");
            }

            return currentUserId;
        }
    }
}
