using System;

namespace LinqUp.Shared
{
    public class MessageAttachment
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid? TeamMessageId { get; set; }
        public TeamMessage? TeamMessage { get; set; }

        public string OriginalFileName { get; set; } = string.Empty;

        public string StorageFileName { get; set; } = string.Empty;

        public string ContentType { get; set; } = "application/octet-stream";

        public long FileSize { get; set; }

        public bool IsImage { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
