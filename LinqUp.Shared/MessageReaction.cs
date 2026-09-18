using System;

namespace LinqUp.Shared
{
    public class MessageReaction
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamMessageId { get; set; }
        public TeamMessage? TeamMessage { get; set; }

        public Guid UserId { get; set; }

        public string Emoji { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
