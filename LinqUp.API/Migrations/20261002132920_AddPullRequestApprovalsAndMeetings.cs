using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinqUp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPullRequestApprovalsAndMeetings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectMeetings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RoomName = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    HostUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectMeetings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProjectPullRequestApprovals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PullNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserNickname = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    UserFullName = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    UserAvatarPath = table.Column<string>(type: "TEXT", nullable: true),
                    Comment = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    SyncedToGitHub = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectPullRequestApprovals", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMeetings_TeamProjectId_IsActive",
                table: "ProjectMeetings",
                columns: new[] { "TeamProjectId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectPullRequestApprovals_TeamProjectId_PullNumber",
                table: "ProjectPullRequestApprovals",
                columns: new[] { "TeamProjectId", "PullNumber" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectMeetings");

            migrationBuilder.DropTable(
                name: "ProjectPullRequestApprovals");
        }
    }
}
