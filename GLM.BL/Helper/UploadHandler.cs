using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Game_Library_Management_BL.Helper
{
    public class UploadHandler
    {
        private readonly string _connectionString;
        private readonly string _containerName;

        public UploadHandler(IConfiguration configuration)
        {
            _connectionString = configuration["AzureStorage:ConnectionString"];
            _containerName = configuration["AzureStorage:ContainerName"];
        }

        public async Task<string> UploadAsync(IFormFile file)
        {
            // Check File Extension
            List<string> validExtensions = new List<string> { ".jpg", ".jpeg", ".png" };
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (!validExtensions.Contains(extension))
                return $"Invalid File Extension ({string.Join(',', validExtensions)})";

            // Check Size
            if (file.Length > 5 * 1024 * 1024)
                return "File size exceeds the 5MB limit.";

            // Upload to Azure Blob Storage
            var fileName = Guid.NewGuid().ToString() + extension;
            var blobServiceClient = new BlobServiceClient(_connectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);

            using (var stream = file.OpenReadStream())
            {
                await blobClient.UploadAsync(stream, new BlobHttpHeaders
                {
                    ContentType = file.ContentType
                });
            }

            // Return full URL instead of just filename
            return blobClient.Uri.ToString();
        }
    }
}