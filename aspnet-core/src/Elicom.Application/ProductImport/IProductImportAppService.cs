using System.Threading.Tasks;
using Abp.Application.Services;

namespace Elicom.ProductImport
{
    public interface IProductImportAppService : IApplicationService
    {
        Task<ProductImportResultDto> FetchProductByUrl(ProductImportRequestDto input);
    }
}
