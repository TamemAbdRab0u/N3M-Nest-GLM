using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Game_Library_Management_BL.Helper
{
    public class UploadHandler
    {
        public async Task<string> UploadAsync(IFormFile file)
        {
            // Check File Extension
            List<string> ValidExtensions = new List<string> { ".jpg", ".jpeg", ".png" };
            var extension = Path.GetExtension(file.FileName).ToLower();

            if (!ValidExtensions.Contains(extension))
            {
                return $"Invalid File Extension ({string.Join(',', ValidExtensions)})";
            }

            // Check Size
            var size = file.Length;
            if (size > 5 * 1024 * 1024)
            {
                return "File size exceeds the 5MB limit.";
            }

            // Name and Save File
            var fileName = Guid.NewGuid().ToString() + extension;
            var path = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");

            if (!Directory.Exists(path))
                Directory.CreateDirectory(path);

            var filePath = Path.Combine(path, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true))
            {
                await file.CopyToAsync(stream);
            }

            return fileName;
        }
    }


}
