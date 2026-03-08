using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Elicom.Products.Dto;
using System;
using System.Threading.Tasks;

namespace Elicom.ResellerMarketplace
{
    public interface IResellerMarketplaceAppService : IApplicationService
    {
        Task<ListResultDto<ProductDto>> GetAvailableProducts();
        Task<ProductDto> GetProductDetails(Guid productId);
        Task AddToStore(Guid productId, decimal resellerPrice);
    }
}
