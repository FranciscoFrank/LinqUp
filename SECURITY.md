# Security Policy

The LinqUp team and community take the security and privacy of our platform, our contributors, and our users very seriously. We appreciate your efforts to responsibly disclose any security vulnerabilities.

---

## Supported Versions

Only the latest active release and the `main` branch are actively monitored and supported with security updates.

| Version | Supported          | Runtime    | Status      |
| ------- | ------------------ | ---------- | ----------- |
| `1.0.x` / `main` | :white_check_mark: | .NET 10.0  | Supported   |
| `< 1.0` | :x:                | -          | Unsupported |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

If you believe you have discovered a security vulnerability in LinqUp, please report it through one of the following channels:

1. **GitHub Private Security Advisory (Recommended)**:
   Navigate to the [Security Advisories](https://github.com/FranciscoFrank/LinqUp/security/advisories) tab of the repository and click **"Report a vulnerability"**. This allows for encrypted, private collaboration and coordinated disclosure.
2. **Direct Contact**:
   Send an email to the repository owner or project maintainers with the subject line `[SECURITY] LinqUp Vulnerability Report`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:
- A detailed description of the vulnerability.
- Clear step-by-step instructions or a minimal Proof of Concept (PoC) to reproduce the issue.
- The affected component (`LinqUp.API`, `LinqUp.Web`, `LinqUp.Shared`, or specific service/controller).
- Potential impact and attack vectors.
- Any suggested mitigations or patches (if available).

### Response Process & SLA

- **Acknowledgment**: We aim to acknowledge receipt of your vulnerability report within **48 hours**.
- **Assessment**: We will investigate and assess the severity within **5 business days**.
- **Fix & Disclosure**: We will work on a patch and coordinate a release date before any public announcement. We will credit you for the discovery (unless you prefer to remain anonymous).

---

## LinqUp Security Architecture

LinqUp is built on ASP.NET Core 10 and implements multi-layer defense mechanisms:

### 1. Password Hashing (Argon2id)
- Passwords are encrypted using **Argon2id** (`Konscious.Security.Cryptography.Argon2`), the industry-standard memory-hard hashing algorithm, overriding default PBKDF2 implementations.
- Secure salting and tuned memory/iteration parameters mitigate GPU-accelerated brute-force attacks.

### 2. Session Management & JWT Authentication
- **Token Mechanism**: Authentication utilizes signed JSON Web Tokens (JWT) using HMAC-SHA256.
- **Revocable Sessions**: Every issued token is linked to a database-backed session (`UserSession` with unique `sid` claim). 
- **Real-Time Revocation Check**: The API validates session state, expiration, and revocation status in the database on every authenticated request, allowing immediate remote session termination.
- **Secure Cookie Transport**: Access tokens for web sessions are carried via `HttpOnly`, `SameSite=Lax`, and `Secure` cookies over HTTPS.

### 3. Account Lockout & Brute Force Defense
- Configured via ASP.NET Core Identity:
  - Maximum failed login attempts: **5 attempts**.
  - Default lockout duration: **10 minutes**.
  - Rate-limited authentication endpoints.

### 4. Application Rate Limiting
- Built-in partitioned rate limiter (`Microsoft.AspNetCore.RateLimiting`) enforcing a fixed window limit of **100 requests per minute** per client IP or Host header, mitigating automated scraping and DoS attempts (HTTP 429 Too Many Requests).

### 5. CORS Policies
- Cross-Origin Resource Sharing is strictly scoped to authorized origins (`https://localhost:7220`, `http://localhost:5220` in development, configurable per environment). Wildcard origins (`*`) are disallowed for credentialed calls.

### 6. Real-Time & Media Security
- **SignalR WebSockets**: Authenticated via bearer tokens passed via query strings or HTTP cookies, verified before establishing full duplex connections (`TeamChatHub`).
- **LiveKit WebRTC Meetings**: Video/Audio room tokens are short-lived, digitally signed with server-side API secrets, and granted on a per-user, per-project basis with explicit room permissions.

---

## Security Best Practices for Developers & Deployers

When setting up or deploying LinqUp:
- **Never commit secrets**: Never hardcode production JWT signing keys, Resend API keys, LiveKit credentials, or database passwords in source code.
- **Use Secret Management**: Use `dotnet user-secrets` in development and environment variables or Azure Key Vault / AWS Secrets Manager in production.
- **Enforce HTTPS**: Always run behind TLS/HTTPS in staging and production with modern cipher suites.
- **Database Safety**: Parameterize all queries through Entity Framework Core to eliminate SQL injection risks.
