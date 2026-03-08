using Microsoft.Extensions.Configuration;
using System;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;

namespace Elicom.Storage
{
    public class BlobStorageService : IBlobStorageService
    {
        private readonly IConfiguration _configuration;
        private const string ContainerName = "primeship-products";
        private const string DefaultLocalRootPath = @"C:\data\uploads";
        private const string DefaultRequestPath = "/uploads";

        public BlobStorageService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> UploadImageAsync(string base64Image, string fileName)
        {
            Console.WriteLine($"[BlobStorage] Upload attempt: {fileName}");
            if (string.IsNullOrEmpty(base64Image))
            {
                Console.WriteLine("[BlobStorage] Error: Base64 string is null or empty");
                return null;
            }

            Console.WriteLine($"[BlobStorage] Base64 length: {base64Image.Length}");

            // Handle data:image/png;base64,... format
            if (base64Image.Contains(","))
            {
                base64Image = base64Image.Split(',')[1];
                Console.WriteLine("[BlobStorage] Trimmed Data URL prefix");
            }

            var bytes = Convert.FromBase64String(base64Image);
            Console.WriteLine($"[BlobStorage] Decoded bytes: {bytes.Length}");

            var localRootPath = _configuration["FileStorage:LocalRootPath"];
            if (string.IsNullOrWhiteSpace(localRootPath))
            {
                localRootPath = DefaultLocalRootPath;
            }

            var requestPath = _configuration["FileStorage:RequestPath"];
            if (string.IsNullOrWhiteSpace(requestPath))
            {
                requestPath = DefaultRequestPath;
            }

            requestPath = "/" + requestPath.Trim().Trim('/');

            var containerPath = Path.Combine(localRootPath, ContainerName);
            Directory.CreateDirectory(containerPath);

            var safeFileName = GetSafeFileName(fileName);
            var finalPath = Path.Combine(containerPath, safeFileName);

            if (File.Exists(finalPath))
            {
                var nameWithoutExt = Path.GetFileNameWithoutExtension(safeFileName);
                var ext = Path.GetExtension(safeFileName);
                safeFileName = $"{nameWithoutExt}_{Guid.NewGuid():N}{ext}";
                finalPath = Path.Combine(containerPath, safeFileName);
            }

            await File.WriteAllBytesAsync(finalPath, bytes);

            var relativeUrlPath = $"{requestPath}/{ContainerName}/{Uri.EscapeDataString(safeFileName)}";
            var publicUrl = BuildPublicUrl(relativeUrlPath);

            Console.WriteLine($"[BlobStorage] Successfully uploaded to local file: {finalPath}");
            Console.WriteLine($"[BlobStorage] Public URL: {publicUrl}");
            return publicUrl;
        }

        private string GetContentType(string fileName)
        {
            var ext = Path.GetExtension(fileName).ToLower();
            return ext switch
            {
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                _ => "application/octet-stream"
            };
        }

        private static string GetSafeFileName(string fileName)
        {
            var incomingName = Path.GetFileName(fileName ?? string.Empty);
            if (string.IsNullOrWhiteSpace(incomingName))
            {
                return $"img_{DateTime.UtcNow.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture)}.bin";
            }

            foreach (var invalidChar in Path.GetInvalidFileNameChars())
            {
                incomingName = incomingName.Replace(invalidChar, '_');
            }

            return incomingName;
        }

        private string BuildPublicUrl(string relativeUrlPath)
        {
            var configuredBase = _configuration["FileStorage:PublicBaseUrl"];
            if (string.IsNullOrWhiteSpace(configuredBase))
            {
                configuredBase = _configuration["App:ServerRootAddress"];
            }

            if (string.IsNullOrWhiteSpace(configuredBase))
            {
                return relativeUrlPath;
            }

            configuredBase = configuredBase.Trim();
            if (!configuredBase.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !configuredBase.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                configuredBase = "https://" + configuredBase;
            }

            configuredBase = configuredBase.TrimEnd('/');
            return configuredBase + relativeUrlPath;
        }
    }
}
