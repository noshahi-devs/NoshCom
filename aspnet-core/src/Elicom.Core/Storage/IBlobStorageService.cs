using Abp.Dependency;
using System.Threading.Tasks;

namespace Elicom.Storage
{
    public interface IBlobStorageService : ITransientDependency
    {
        Task<string> UploadImageAsync(string base64Image, string fileName);
    }
}
