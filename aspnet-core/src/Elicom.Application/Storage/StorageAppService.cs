using Abp.Application.Services;
using Abp.Authorization;
using Elicom.Storage.Dto;
using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Elicom.Storage
{
    [AbpAllowAnonymous]
    public class StorageAppService : ElicomAppServiceBase
    {
        private readonly IBlobStorageService _blobStorageService;

        public StorageAppService(IBlobStorageService blobStorageService)
        {
            _blobStorageService = blobStorageService;
        }

        public async Task<string> UploadImage(UploadImageInput input)
        {
            // Sanitize prefix or use default
            string prefix = "Image";
            if (!string.IsNullOrWhiteSpace(input.FileName))
            {
                // Remove invalid chars and "test" prefix if present for some reason
                prefix = Regex.Replace(input.FileName, @"[^a-zA-Z0-9_\-]", "");
                if (prefix.ToLower().StartsWith("test"))
                {
                    prefix = prefix.Substring(4).TrimStart('_', '-');
                }
                
                if (string.IsNullOrWhiteSpace(prefix)) prefix = "Image";
            }

            // Proper naming: {Prefix}_{Timestamp}.png
            // Format: yyyyMMddHHmmss
            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
            var fileName = $"{prefix}_{timestamp}.png";

            Console.WriteLine($"[Storage] Uploading: {fileName}");
            return await _blobStorageService.UploadImageAsync(input.Base64Image, fileName);
        }
    }
}
