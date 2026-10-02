using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinqUp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamFormationAndMessaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProjectMemberships_TeamProjectId",
                table: "ProjectMemberships");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                table: "TeamProjects",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "RequiredSkills",
                table: "TeamProjects",
                type: "TEXT",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "TeamProjects",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "JoinedAt",
                table: "ProjectMemberships",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "ProjectJoinRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CoverMessage = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    RequestedRole = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectJoinRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectJoinRequests_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectJoinRequests_TeamProjects_TeamProjectId",
                        column: x => x.TeamProjectId,
                        principalTable: "TeamProjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SenderId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Content = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamMessages_AspNetUsers_SenderId",
                        column: x => x.SenderId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamMessages_TeamProjects_TeamProjectId",
                        column: x => x.TeamProjectId,
                        principalTable: "TeamProjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MessageAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamMessageId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OriginalFileName = table.Column<string>(type: "TEXT", maxLength: 260, nullable: false),
                    StorageFileName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    ContentType = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "INTEGER", nullable: false),
                    IsImage = table.Column<bool>(type: "INTEGER", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageAttachments_TeamMessages_TeamMessageId",
                        column: x => x.TeamMessageId,
                        principalTable: "TeamMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MessageMentions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamMessageId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MentionedUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MentionedNickname = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageMentions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageMentions_TeamMessages_TeamMessageId",
                        column: x => x.TeamMessageId,
                        principalTable: "TeamMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamProjects_CreatorId",
                table: "TeamProjects",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMemberships_TeamProjectId_UserId",
                table: "ProjectMemberships",
                columns: new[] { "TeamProjectId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMemberships_UserId",
                table: "ProjectMemberships",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageAttachments_TeamMessageId",
                table: "MessageAttachments",
                column: "TeamMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageMentions_MentionedUserId_TeamMessageId",
                table: "MessageMentions",
                columns: new[] { "MentionedUserId", "TeamMessageId" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageMentions_TeamMessageId",
                table: "MessageMentions",
                column: "TeamMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectJoinRequests_TeamProjectId_UserId_Status",
                table: "ProjectJoinRequests",
                columns: new[] { "TeamProjectId", "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectJoinRequests_UserId",
                table: "ProjectJoinRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamMessages_SenderId",
                table: "TeamMessages",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamMessages_TeamProjectId_CreatedAt",
                table: "TeamMessages",
                columns: new[] { "TeamProjectId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectMemberships_AspNetUsers_UserId",
                table: "ProjectMemberships",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamProjects_AspNetUsers_CreatorId",
                table: "TeamProjects",
                column: "CreatorId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectMemberships_AspNetUsers_UserId",
                table: "ProjectMemberships");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamProjects_AspNetUsers_CreatorId",
                table: "TeamProjects");

            migrationBuilder.DropTable(
                name: "MessageAttachments");

            migrationBuilder.DropTable(
                name: "MessageMentions");

            migrationBuilder.DropTable(
                name: "ProjectJoinRequests");

            migrationBuilder.DropTable(
                name: "TeamMessages");

            migrationBuilder.DropIndex(
                name: "IX_TeamProjects_CreatorId",
                table: "TeamProjects");

            migrationBuilder.DropIndex(
                name: "IX_ProjectMemberships_TeamProjectId_UserId",
                table: "ProjectMemberships");

            migrationBuilder.DropIndex(
                name: "IX_ProjectMemberships_UserId",
                table: "ProjectMemberships");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "TeamProjects");

            migrationBuilder.DropColumn(
                name: "RequiredSkills",
                table: "TeamProjects");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "TeamProjects");

            migrationBuilder.DropColumn(
                name: "JoinedAt",
                table: "ProjectMemberships");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMemberships_TeamProjectId",
                table: "ProjectMemberships",
                column: "TeamProjectId");
        }
    }
}
