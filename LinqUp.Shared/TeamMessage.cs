using System;
using System.Collections.Generic;

namespace LinqUp.Shared
{
    public class TeamMessage
    {
        public Guid Id { get; set; } = Guid.CreateVersion7();

        public Guid TeamProjectId { get; set; }
        public TeamProject? TeamProject { get; set; }

        public Guid? ChannelId { get; set; }
        public ProjectChannel? Channel { get; set; }

        public Guid SenderId { get; set; }

        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<MessageAttachment> Attachments { get; set; } = new();

        public List<MessageMention> Mentions { get; set; } = new();

        public List<MessageReaction> Reactions { get; set; } = new();
    }
}
