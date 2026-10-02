using LinqUp.API.Entities;
using LinqUp.API.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using LinqUp.Shared;

namespace LinqUp.API.Data
{
    public class AppDbContext : IdentityUserContext<ApplicationUser, Guid>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<ContactMethod> ContactMethods { get; set; } = null!;
        public DbSet<Skill> Skills { get; set; } = null!;
        public DbSet<UserSkill> UserSkills { get; set; } = null!;
        public DbSet<UserSession> UserSessions { get; set; } = null!;
        public DbSet<UserIntegration> UserIntegrations { get; set; } = null!;
        public DbSet<UserConnection> UserConnections { get; set; } = null!;
        public DbSet<SkillEndorsement> SkillEndorsements { get; set; } = null!;

        public DbSet<TeamProject> TeamProjects { get; set; } = null!;
        public DbSet<ProjectMembership> ProjectMemberships { get; set; } = null!;
        public DbSet<ProjectJoinRequest> ProjectJoinRequests { get; set; } = null!;
        public DbSet<ProjectTask> ProjectTasks { get; set; } = null!;
        public DbSet<ProjectChannel> ProjectChannels { get; set; } = null!;
        public DbSet<TeamMessage> TeamMessages { get; set; } = null!;
        public DbSet<MessageAttachment> MessageAttachments { get; set; } = null!;
        public DbSet<MessageMention> MessageMentions { get; set; } = null!;
        public DbSet<MessageReaction> MessageReactions { get; set; } = null!;
        public DbSet<ProjectPullRequestApproval> ProjectPullRequestApprovals { get; set; } = null!;
        public DbSet<ProjectMeeting> ProjectMeetings { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ApplicationUser>(builder =>
            {
                builder.Property(u => u.FirstName).HasMaxLength(100);
                builder.Property(u => u.LastName).HasMaxLength(100);
                builder.Property(u => u.Nickname).HasMaxLength(30);
                builder.Property(u => u.Bio).HasMaxLength(500);
                builder.Property(u => u.Goal).HasMaxLength(50);

                builder.HasIndex(u => u.Nickname).IsUnique();
            });

            modelBuilder.Entity<ContactMethod>()
                .HasOne(c => c.User)
                .WithMany(u => u.ContactMethods)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserSkill>()
                .HasOne(us => us.User)
                .WithMany(u => u.Skills)
                .HasForeignKey(us => us.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserSkill>()
                .HasOne(us => us.Skill)
                .WithMany(s => s.UserSkills)
                .HasForeignKey(us => us.SkillId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserSkill>()
                .HasIndex(us => new { us.UserId, us.SkillId })
                .IsUnique();

            modelBuilder.Entity<Skill>()
                .HasIndex(s => s.Name)
                .IsUnique();

            modelBuilder.Entity<UserSession>()
                .HasOne(s => s.User)
                .WithMany(u => u.Sessions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserSession>()
                .HasIndex(s => s.RefreshTokenHash)
                .IsUnique();

            modelBuilder.Entity<UserIntegration>(builder =>
            {
                builder.Property(i => i.Provider).HasMaxLength(50);
                builder.Property(i => i.AccountIdentifier).HasMaxLength(150);

                builder.HasOne(i => i.User)
                    .WithMany(u => u.Integrations)
                    .HasForeignKey(i => i.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(i => new { i.UserId, i.Provider }).IsUnique();
            });

            modelBuilder.Entity<UserConnection>(builder =>
            {
                builder.HasOne(c => c.Requester)
                    .WithMany(u => u.Connections)
                    .HasForeignKey(c => c.RequesterId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne(c => c.TargetUser)
                    .WithMany() // No reverse navigation to avoid cycle mapping issues, or map carefully
                    .HasForeignKey(c => c.TargetUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                builder.HasIndex(c => new { c.RequesterId, c.TargetUserId }).IsUnique();
            });

            modelBuilder.Entity<SkillEndorsement>(builder =>
            {
                builder.HasOne(e => e.Endorser)
                    .WithMany(u => u.GivenEndorsements)
                    .HasForeignKey(e => e.EndorserId)
                    .OnDelete(DeleteBehavior.Restrict);

                builder.HasOne(e => e.EndorsedUser)
                    .WithMany(u => u.ReceivedEndorsements)
                    .HasForeignKey(e => e.EndorsedUserId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                builder.HasOne(e => e.Skill)
                    .WithMany()
                    .HasForeignKey(e => e.SkillId)
                    .OnDelete(DeleteBehavior.Restrict);

                builder.HasIndex(e => new { e.EndorserId, e.EndorsedUserId, e.SkillId }).IsUnique();
            });

            modelBuilder.Entity<TeamProject>(builder =>
            {
                builder.Property(p => p.Title).HasMaxLength(150);
                builder.Property(p => p.Description).HasMaxLength(4000);
                builder.Property(p => p.RequiredSkills).HasMaxLength(1000);
                builder.Property(p => p.LogoUrl).HasMaxLength(500);

                builder.HasIndex(p => p.Title).IsUnique();

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(p => p.CreatorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ProjectMembership>(builder =>
            {
                builder.Property(pm => pm.Role).HasMaxLength(60);

                builder.HasOne(pm => pm.TeamProject)
                    .WithMany(p => p.Members)
                    .HasForeignKey(pm => pm.TeamProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(pm => pm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(pm => new { pm.TeamProjectId, pm.UserId }).IsUnique();
            });

            modelBuilder.Entity<ProjectJoinRequest>(builder =>
            {
                builder.Property(r => r.CoverMessage).HasMaxLength(1000);
                builder.Property(r => r.RequestedRole).HasMaxLength(60);

                builder.HasOne(r => r.TeamProject)
                    .WithMany(p => p.JoinRequests)
                    .HasForeignKey(r => r.TeamProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(r => r.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(r => new { r.TeamProjectId, r.UserId, r.Status });
            });

            modelBuilder.Entity<ProjectTask>(builder =>
            {
                builder.Property(t => t.Title).HasMaxLength(200);
                builder.Property(t => t.Description).HasMaxLength(4000);
                builder.Property(t => t.Status).HasMaxLength(50);

                builder.HasOne(t => t.TeamProject)
                    .WithMany()
                    .HasForeignKey(t => t.TeamProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(t => t.AssigneeId)
                    .OnDelete(DeleteBehavior.SetNull);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(t => t.CreatorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ProjectChannel>(builder =>
            {
                builder.Property(c => c.Name).HasMaxLength(100);
                builder.Property(c => c.Description).HasMaxLength(500);

                builder.HasOne(c => c.TeamProject)
                    .WithMany(p => p.Channels)
                    .HasForeignKey(c => c.TeamProjectId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TeamMessage>(builder =>
            {
                builder.Property(m => m.Content).HasMaxLength(4000);

                builder.HasOne(m => m.TeamProject)
                    .WithMany(p => p.Messages)
                    .HasForeignKey(m => m.TeamProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne(m => m.Channel)
                    .WithMany()
                    .HasForeignKey(m => m.ChannelId)
                    .OnDelete(DeleteBehavior.SetNull);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(m => m.SenderId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(m => new { m.TeamProjectId, m.CreatedAt });
            });

            modelBuilder.Entity<MessageAttachment>(builder =>
            {
                builder.Property(a => a.OriginalFileName).HasMaxLength(260);
                builder.Property(a => a.StorageFileName).HasMaxLength(100);
                builder.Property(a => a.ContentType).HasMaxLength(100);

                builder.HasOne(a => a.TeamMessage)
                    .WithMany(m => m.Attachments)
                    .HasForeignKey(a => a.TeamMessageId)
                    .IsRequired(false)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<MessageMention>(builder =>
            {
                builder.Property(m => m.MentionedNickname).HasMaxLength(30);

                builder.HasOne(m => m.TeamMessage)
                    .WithMany(msg => msg.Mentions)
                    .HasForeignKey(m => m.TeamMessageId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(m => new { m.MentionedUserId, m.TeamMessageId });
            });

            modelBuilder.Entity<MessageReaction>(builder =>
            {
                builder.Property(r => r.Emoji).HasMaxLength(50);

                builder.HasOne(r => r.TeamMessage)
                    .WithMany(m => m.Reactions)
                    .HasForeignKey(r => r.TeamMessageId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(r => r.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                builder.HasIndex(r => new { r.TeamMessageId, r.UserId, r.Emoji }).IsUnique();
            });

            modelBuilder.Entity<ProjectPullRequestApproval>(builder =>
            {
                builder.HasIndex(a => new { a.TeamProjectId, a.PullNumber });
                builder.Property(a => a.UserNickname).HasMaxLength(50);
                builder.Property(a => a.UserFullName).HasMaxLength(150);
                builder.Property(a => a.Comment).HasMaxLength(1000);
            });

            modelBuilder.Entity<ProjectMeeting>(builder =>
            {
                builder.HasIndex(m => new { m.TeamProjectId, m.IsActive });
                builder.Property(m => m.RoomName).HasMaxLength(120);
                builder.Property(m => m.Title).HasMaxLength(150);
            });

            // Fixed GUIDs (not CreateVersion7()) — HasData seed values must be static across migrations.
            modelBuilder.Entity<Skill>().HasData(
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000001"), Name = "C++", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000002"), Name = "C", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000003"), Name = "C#", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000004"), Name = "Java", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000005"), Name = "Python", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000006"), Name = "JavaScript", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000007"), Name = "PHP", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000008"), Name = "Ruby", IsPreset = true },
                new Skill { Id = Guid.Parse("00000000-0000-7000-8000-000000000009"), Name = "Node.js", IsPreset = true }
            );
        }
    }
}
