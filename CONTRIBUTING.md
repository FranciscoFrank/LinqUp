# Contributing to LinqUp

First off, thank you for considering contributing to **LinqUp**! 🎉 

LinqUp is built to help developers, designers, students, and creators find like-minded collaborators and bring ambitious projects to life. Whether you are fixing a bug, proposing a new feature, improving documentation, or adding localized content, your contributions are warmly welcomed.

Please take a moment to review this document to ensure an efficient and collaborative contribution process.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Translations & Localization](#translations--localization)
  - [Submitting Code Changes](#submitting-code-changes)
- [Repository Structure](#repository-structure)
- [Local Development Setup](#local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Cloning and Building](#cloning-and-building)
  - [Running the Application](#running-the-application)
- [Development Guidelines](#development-guidelines)
  - [Branch Naming](#branch-naming)
  - [Commit Message Format](#commit-message-format)
  - [C# & .NET Standards](#c--net-standards)
  - [Database Migrations](#database-migrations)
  - [Frontend & Localization](#frontend--localization)
- [Pull Request Process](#pull-request-process)
- [Need Help?](#need-help)

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please ensure you treat all members with respect and kindness.

---

## How Can I Contribute?

### Reporting Bugs

If you encounter unexpected behavior or bugs:
1. Search [existing GitHub Issues](https://github.com/FranciscoFrank/LinqUp/issues) to ensure it hasn't already been reported.
2. Open a new issue with a clear title and description including:
   - Steps to reproduce the bug.
   - Expected behavior vs. actual behavior.
   - Screenshots or console logs if applicable.
   - Environment details (.NET SDK version, OS, browser).

> **Note on Security Vulnerabilities**: For sensitive security issues, please do **NOT** submit a public issue. Refer to our [Security Policy](SECURITY.md) for responsible disclosure instructions.

### Suggesting Features

We welcome new ideas! To propose an enhancement or feature:
- Open an issue using the feature request template.
- Describe the motivation, problem it solves, and how it aligns with LinqUp's mission.
- Provide mockup ideas, UI sketches, or API design proposals when possible.

### Translations & Localization

LinqUp supports bilingual interfaces (**Ukrainian `uk`** and **English `en`**). Contributions to expand or refine translations in Razor views and localization dictionaries are greatly appreciated.

### Submitting Code Changes

1. Pick an open issue or start a discussion if you want to propose a large architectural change.
2. Fork the repository and create a feature branch from `main`.
3. Test your changes locally to ensure the solution builds and runs smoothly.
4. Submit a Pull Request targeting the `main` branch.

---

## Repository Structure

The solution consists of three main projects:

```
LinqUp/
├── LinqUp.API/          # ASP.NET Core 10 Web API
│   ├── Controllers/     # REST API controllers (Auth, Projects, Tasks, Chat, GitHub, etc.)
│   ├── Data/            # EF Core DbContext, configuration, SQLite storage
│   ├── Entities/        # Domain entities (Users, Sessions, Skills, Meetings, etc.)
│   ├── Hubs/            # SignalR hubs for real-time team messaging (TeamChatHub)
│   ├── Identity/        # ASP.NET Identity & Argon2id password hashing
│   └── Services/        # Business logic, LiveKit meetings, GitHub service, token management
│
├── LinqUp.Web/          # ASP.NET Core 10 Web Application (MVC & Razor Views)
│   ├── Controllers/     # MVC controllers (Home, Projects, Profile, Auth, etc.)
│   ├── Views/           # Razor views with EN/UK localization & interactive workspace
│   └── wwwroot/         # Static CSS, JS modules, images, and brand assets
│
├── LinqUp.Shared/       # Shared Class Library
│   ├── Dtos/            # Data transfer objects across Web and API
│   ├── Enums/           # Domain enumerations (ProjectStatus, TaskStatus, etc.)
│   └── Models/          # Shared domain models
│
├── Justfile             # Task runner automation for just command
├── run.ps1              # Concurrent startup script (PowerShell for Windows)
└── run.sh               # Concurrent startup script (Bash for Linux/macOS)
```

---

## Local Development Setup

### Prerequisites

Make sure you have the following installed:
- **[.NET 10.0 SDK](https://dotnet.microsoft.com/download)** or newer.
- **[Git](https://git-scm.com/)**.
- **[Just](https://github.com/casey/just)** (optional, but recommended task runner).
- An IDE of choice: **Visual Studio 2022 / 2025**, **JetBrains Rider**, or **VS Code** with the C# Dev Kit.

### Cloning and Building

```bash
# Clone the repository
git clone https://github.com/FranciscoFrank/LinqUp.git
cd LinqUp

# Restore and build the solution
dotnet build LinqUp.slnx
```

### Running the Application

You can launch both the **API** and **Web** applications concurrently using one of the following methods:

#### Option 1: Using `just` (Recommended)
```bash
just run
```
Other convenient `just` recipes:
- `just api` — Run API only (`https://localhost:7104`)
- `just web` — Run Web only (`https://localhost:7220`)
- `just build` — Build entire solution
- `just test` — Run automated test suites

#### Option 2: Using Startup Scripts
- **Windows (PowerShell)**:
  ```powershell
  ./run.ps1
  ```
- **Linux / macOS (Bash)**:
  ```bash
  chmod +x ./run.sh
  ./run.sh
  ```

#### Option 3: Manual `dotnet run`
Open two separate terminal windows:
```bash
# Terminal 1: LinqUp.API
dotnet run --project LinqUp.API --launch-profile https

# Terminal 2: LinqUp.Web
dotnet run --project LinqUp.Web --launch-profile https
```

#### Service URLs
- **Web Portal**: [https://localhost:7220](https://localhost:7220)
- **REST API**: [https://localhost:7104](https://localhost:7104)
- **OpenAPI Schema**: [https://localhost:7104/openapi/v1.json](https://localhost:7104/openapi/v1.json)

---

## Development Guidelines

### Branch Naming

Use descriptive branch names with appropriate prefixes:
- `feature/user-profiles` — For new features
- `fix/token-expiration` — For bug fixes
- `docs/contributing-guide` — For documentation updates
- `refactor/chat-service` — For refactoring without behavioral changes
- `test/project-service-tests` — For test additions or improvements

### Commit Message Format

We adhere to [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

**Common types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Formatting, CSS tweaks, missing semicolons (no code logic changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies update

*Example*: `feat(projects): add team role assignment endpoint`

### C# & .NET Standards

- Target **C# 13** and **.NET 10**.
- **Nullable Reference Types** are enabled across all projects (`<Nullable>enable</Nullable>`). Ensure your code is free of nullable compiler warnings.
- Use asynchronous methods (`async` / `await`) throughout API controllers and database access operations.
- Inject dependencies via constructor injection. Avoid static service locators.
- Keep domain models and contracts in `LinqUp.Shared` so they remain clean and reusable.
- Follow ASP.NET Core RESTful API best practices: use proper HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) and return appropriate status codes (`200 OK`, `201 Created`, `204 NoContent`, `400 BadRequest`, `401 Unauthorized`, `404 NotFound`).

### Database Migrations

LinqUp uses Entity Framework Core with SQLite. When modifying entities in `LinqUp.API/Entities` or `LinqUp.Shared`:

```bash
# Add a new migration
dotnet ef migrations add <MigrationName> --project LinqUp.API --startup-project LinqUp.API

# Update local database
dotnet ef database update --project LinqUp.API --startup-project LinqUp.API
```

> Note: The API automatically applies pending migrations upon startup in development mode.

### Frontend & Localization

- LinqUp Web features localized views for **English (`en`)** and **Ukrainian (`uk`)**.
- URL routing is culture-prefixed (e.g. `/uk/Projects`, `/en/Projects`).
- When modifying UI views, ensure labels are localized either via Razor conditional culture checks or `data-i18n` attributes.
- Use CSS variables (`var(--...)`) defined in design systems to maintain consistent theme styles and dark-mode aesthetics.

---

## Pull Request Process

1. **Keep it focused**: One PR per feature or bug fix. Avoid mixing unrelated refactorings.
2. **Build and Test**: Ensure the solution builds cleanly with zero errors:
   ```bash
   dotnet build LinqUp.slnx
   ```
3. **Fill the PR Description**:
   - Provide a clear summary of what was changed and why.
   - Reference corresponding issues (e.g., `Resolves #42`).
   - Include before/after screenshots or GIFs for visual and UI updates.
4. **Code Review**: At least one maintainer review is required before merging. Address review comments respectfully and push updates to your PR branch.

---

## Need Help?

If you have questions, need clarification on architecture, or want to discuss ideas:
- Open a discussion or question in [GitHub Discussions](https://github.com/FranciscoFrank/LinqUp/discussions).
- Create an issue with the `question` label.

Thank you for contributing to the future of collaborative team building with **LinqUp**! 🚀
