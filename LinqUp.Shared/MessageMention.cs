using System;

namespace LinqUp.Shared
{
    public class MessageMention
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamMessageId { get; set; }
        public TeamMessage? TeamMessage { get; set; }

        public Guid MentionedUserId { get; set; }

        public string MentionedNickname { get; set; } = string.Empty;
    }
}
