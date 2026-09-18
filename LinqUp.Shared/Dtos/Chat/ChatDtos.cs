using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LinqUp.Shared.Dtos.Chat
{
    public class TeamMessageDto
    {
        public Guid Id { get; set; }
        public Guid TeamProjectId { get; set; }
        public Guid SenderId { get; set; }
        public string SenderFullName { get; set; } = string.Empty;
        public string SenderNickname { get; set; } = string.Empty;
        public string? SenderAvatarPath { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }

        public List<AttachmentDto> Attachments { get; set; } = new();
        public List<MentionDto> Mentions { get; set; } = new();
        public CodeQuoteDto? CodeQuote { get; set; }
        public List<ReactionDto> Reactions { get; set; } = new();
        public Guid? ReplyToMessageId { get; set; }
    }

    public class AttachmentDto
    {
        public Guid Id { get; set; }
        public string OriginalFileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = "application/octet-stream";
        public long FileSize { get; set; }
        public bool IsImage { get; set; }
        public string DownloadUrl { get; set; } = string.Empty;
        public string ViewUrl { get; set; } = string.Empty;
    }

    public class MentionDto
    {
        public Guid UserId { get; set; }
        public string Nickname { get; set; } = string.Empty;
    }

    public class CodeQuoteDto
    {
        public string Repo { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public string Branch { get; set; } = string.Empty;
        public int StartLine { get; set; }
        public int EndLine { get; set; }
        public string CodeSnippet { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;
    }

    public class ReactionDto
    {
        public string Emoji { get; set; } = string.Empty;
        public int Count { get; set; }
        public List<string> UserNicknames { get; set; } = new();
        public bool HasReacted { get; set; }
    }

    public class SendMessageDto
    {
        [Required]
        public Guid ProjectId { get; set; }

        [StringLength(4000, ErrorMessage = "Повідомлення не може перевищувати 4000 символів")]
        public string Content { get; set; } = string.Empty;

        public List<Guid> AttachmentIds { get; set; } = new();

        public List<string> MentionedNicknames { get; set; } = new();

        public CodeQuoteDto? CodeQuote { get; set; }

        public Guid? ReplyToMessageId { get; set; }
    }

    public class ToggleReactionDto
    {
        [Required]
        public Guid ProjectId { get; set; }

        [Required]
        public Guid MessageId { get; set; }

        [Required]
        [StringLength(50)]
        public string Emoji { get; set; } = string.Empty;
    }

    public class TypingNotificationDto
    {
        public Guid ProjectId { get; set; }
        public Guid UserId { get; set; }
        public string Nickname { get; set; } = string.Empty;
    }
}
