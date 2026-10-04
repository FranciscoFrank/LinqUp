<div align="center">

# 🚀 LinqUp

### *Команда мрії не збирається сама. Вона збирається у LinqUp.*
**Connect. Collaborate. Build Dream Teams.**

[![.NET 10](https://img.shields.io/badge/.NET-10.0-512bd4.svg?style=for-the-badge&logo=dotnet)](https://dotnet.microsoft.com/)
[![C# 13](https://img.shields.io/badge/C%23-13.0-239120.svg?style=for-the-badge&logo=c-sharp)](https://docs.microsoft.com/dotnet/csharp/)
[![SQLite](https://img.shields.io/badge/SQLite-EF_Core-003B57.svg?style=for-the-badge&logo=sqlite)](https://www.sqlite.org/)
[![SignalR](https://img.shields.io/badge/Real--Time-SignalR-blueviolet.svg?style=for-the-badge&logo=socketdotio)](https://dotnet.microsoft.com/apps/aspnet/signalr)
[![LiveKit](https://img.shields.io/badge/Video-LiveKit_WebRTC-00E5FF.svg?style=for-the-badge&logo=webrtc)](https://livekit.io/)
[![Security: Argon2id](https://img.shields.io/badge/Security-Argon2id_%26_JWT-2ea44f.svg?style=for-the-badge)](https://en.wikipedia.org/wiki/Argon2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

<p align="center">
  <b>LinqUp</b> — це сучасна платформа для пошуку партнерів, збирання команд та спільної розробки амбітних IT-проєктів. <br />
  Об'єднує розробників, дизайнерів, менеджерів та студентів через розумний підбір за навичками, інтегрований командний простір, відеозустрічі LiveKit та синхронізацію з GitHub.
</p>

[✨ Можливості](#-ключові-можливості--key-features) •
[🏗️ Архітектура](#-архітектура-та-технологічний-стек) •
[⚡ Швидкий старт](#-швидкий-старт--getting-started) •
[⚙️ Конфігурація](#-конфігурація) •
[🤝 Спільнота](#-спільнота-та-внесок)

</div>

---

## 🌟 Про проєкт / About LinqUp

Знайти вмотивовану команду з потрібними навичками — одна з найскладніших задач для розробників, хакатонщиків та стартап-ініціаторів. **LinqUp** вирішує це завдання комплексним підходом:

1. **Матчинг за реальними навичками**: Алгоритм обчислює відсоток збігу кандидата з потребами проєкту.
2. **Все-в-одному робочий простір**: Більше не потрібно розпорошувати комунікацію між десятком сервісів — чат, дошка завдань, відеодзвінки та пул-реквести GitHub зібрані в одному місці.
3. **Безкомпромісна безпека**: Паролі захищені сучасним алгоритмом Argon2id, сесії мають механізм моментального відкликання, а API захищено рейтінгом запитів.

---

## ✨ Ключові можливості / Key Features

### 🎯 Розумний підбір та граф навичок (Smart Matchmaking)
- **Каталог навичок**: Позначення технічних і soft-skill компетенцій (Frontend, Backend, DevOps, UI/UX, QA тощо).
- **Match Score**: Автоматичний розрахунок відповідності кандидата до вимог команди у відсотках.
- **Підтвердження навичок (Endorsements)**: Колеги по команді можуть підтверджувати компетенції одне одного після завершення завдань.

### 💬 Командний простір та канали (Team Workspace & Real-Time Chat)
- **Канали проєкту**: Розподіл спілкування за тематичними текстовими каналами (за аналогією з Discord/Slack).
- **SignalR Real-Time**: Миттєва доставка повідомлень, індикатори друку, сповіщення.
- **Реакції, згадки (@mentions) та файли**: Обмін зображеннями, файлами завдань та інтерактивні реакції емодзі на повідомлення.

### 📹 Інтегровані відеозустрічі (LiveKit WebRTC Video Meetings)
- **Вбудовані конференції**: Запуск відео- та аудіозустрічей безпосередньо у вікні браузера.
- **Низька затримка**: Працює на базі LiveKit WebRTC SDK із генерацією захищених серверних токенів.
- Жодних сторонніх посилань на сторонні платформи — усе відбувається в межах проєкту.

### 📋 Управління завданнями (Kanban & Task Tracking)
- **Дошка завдань**: Статуси *To Do*, *In Progress*, *In Review*, *Done*.
- **Пріоритети та дедлайни**: Встановлення термінів, пріоритетів (Low, Medium, High, Critical) та призначення відповідальних учасників команди.

### 🐙 Інтеграція з GitHub (GitHub Integration)
- **Прив'язка репозиторіїв**: Підключення GitHub-репозиторію до проєкту через API.
- **Моніторинг Pull Requests**: Перегляд відкритих PR безпосередньо в командному центрі.
- **Внутрішні схвалення PR**: Механізм затвердження змін командою перед фінальним злиттям.

### 🛡️ Надійна система безпеки (Enterprise-Grade Security)
- **Argon2id Password Hasher**: Перевизначено стандартний PBKDF2 на криптографічно стійкий memory-hard хешер `Argon2id`.
- **JWT з базою сесій (`UserSession`)**: Кожен токен прив'язаний до ідентифікатора сесії в базі даних, що дозволяє дистанційно завершувати активні сесії на окремих або всіх пристроях.
- **Rate Limiting**: Вбудоване обмеження частоти запитів (100 запитів на хвилину на IP/Host) проти брутфорсу та DoS.
- **Identity Lockout**: Автоматичне блокування облікового запису на 10 хвилин після 5 невдалих спроб входу.

### 🌐 Повна двомовність (Bilingual Support)
- Інтерфейс повністю адаптований двома мовами: **Українською (`uk`)** та **Англійською (`en`)** з автовизначенням та зручним перемиканням.

---

## 🏗️ Архітектура та технологічний стек

Проєкт спроєктовано за принципами чистої модульної архітектури на платформі **.NET 10**:

```
                       ┌─────────────────────────┐
                       │       Веб-браузер       │
                       │   (Razor / HTML5 / JS)  │
                       └────────────┬────────────┘
                                    │ HTTPS (:7220)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              LinqUp.Web                                │
│         (ASP.NET Core 10 MVC, Bilingual Routing, UI Components)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ REST API & SignalR (:7104)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              LinqUp.API                                │
│  ┌────────────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │   ASP.NET Identity     │  │   SignalR      │  │  LiveKit Meeting │  │
│  │   Argon2id Hasher      │  │   TeamChatHub  │  │  WebRTC Service  │  │
│  └───────────┬────────────┘  └───────┬────────┘  └────────┬─────────┘  │
│              │                       │                    │            │
│              └───────────────────────┼────────────────────┘            │
│                                      ▼                                 │
│                        ┌──────────────────────────┐                    │
│                        │ Entity Framework Core 10 │                    │
│                        │    (SQLite Storage)      │                    │
│                        └──────────────────────────┘                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             LinqUp.Shared                              │
│             (DTOs, Models, Enums, Constants & Contracts)               │
└────────────────────────────────────────────────────────────────────────┘
```

### Стек технологій

| Компонент | Технологія | Опис |
| --------- | ---------- | ---- |
| **Backend Framework** | ASP.NET Core 10 (`net10.0`) | Високопродуктивний Web API та сервісний шар |
| **Мова розробки** | C# 13 | Сучасні можливості C# з увімкненим Nullable Reference Types |
| **База даних** | SQLite & EF Core 10 | Автономне зберігання даних з підтримкою міграцій |
| **Real-Time комунікація** | Microsoft SignalR | Двосторонній веб-сокет зв'язок для каналів та чатів |
| **Відеоконференції** | LiveKit Server .NET SDK | Масштабовані WebRTC аудіо- та відеокімнати |
| **Криптографія** | Argon2id (`Konscious.Security`) | Сучасне memory-hard хешування паролів |
| **Аутентифікація** | JWT Bearer & DB Sessions | Безпечні токени з валідацією стану сесії в БД |
| **Frontend** | Razor Views + Vanilla JS & CSS | Чуйний, швидкий інтерфейс без громіздких залежностей |
| **Поштові сповіщення** | Resend API | Відправка листів підтвердження та запрошень |

---

## 📁 Структура репозиторію

```
LinqUp/
├── LinqUp.API/                  # REST Web API сервіси
│   ├── Controllers/             # Контролери (Auth, Projects, Tasks, Chat, GitHub, Meetings)
│   ├── Data/                    # AppDbContext, конфігурація сутностей SQLite
│   ├── Entities/                # Сутності БД (UserSession, Skill, Meeting, PullRequest тощо)
│   ├── Hubs/                    # SignalR хаби (TeamChatHub)
│   ├── Identity/                # Налаштування ASP.NET Identity та Argon2id
│   └── Services/                # LiveKitMeetingService, GitHubService, TokenService
│
├── LinqUp.Web/                  # Веб-інтерфейс (MVC)
│   ├── Controllers/             # MVC контролери сторінок
│   ├── Views/                   # Локалізовані Razor-шаблони
│   │   ├── Auth/                # Сторінки входу, реєстрації, підтвердження
│   │   ├── Home/                # Головна сторінка, FAQ, контакти
│   │   ├── Profile/             # Профілі користувачів та налаштування навичок
│   │   ├── Projects/            # Каталог проєктів та робочий простір команди
│   │   └── Shared/              # Загальні лейаути та компоненти
│   └── wwwroot/                 # Стилі (CSS), клієнтські скрипти та ассети
│
├── LinqUp.Shared/               # Спільна бібліотека (DTOs, Enums, Models)
├── Justfile                     # Автоматизація команд для утиліти just
├── run.ps1                      # Скрипт запуску для Windows (PowerShell)
├── run.sh                       # Скрипт запуску для Linux/macOS (Bash)
├── LinqUp.slnx                  # Рішення для Visual Studio / Rider
├── SECURITY.md                  # Політика безпеки та звітність про вразливості
├── CONTRIBUTING.md              # Інструкція для контриб'юторів
└── CODE_OF_CONDUCT.md           # Кодекс поведінки спільноти
```

---

## ⚡ Швидкий старт / Getting Started

### Вимоги (Prerequisites)
- Встановлений **[.NET 10.0 SDK](https://dotnet.microsoft.com/download)** або новіший.
- **[Git](https://git-scm.com/)**.
- *(Опціонально)* Утиліта **[just](https://github.com/casey/just)** для швидкого запуску команд.

### 1. Клонування репозиторію
```bash
git clone https://github.com/FranciscoFrank/LinqUp.git
cd LinqUp
```

### 2. Збірка проєкту
```bash
dotnet build LinqUp.slnx
```

### 3. Одночасний запуск API та Веб-сервісів

Виберіть найзручніший для вас спосіб:

#### Варіант А: Через `just` (Рекомендовано)
```bash
just run
```

#### Варіант Б: Через PowerShell (Windows)
```powershell
./run.ps1
```

#### Варіант В: Через Bash (Linux / macOS)
```bash
chmod +x ./run.sh
./run.sh
```

#### Варіант Г: Ручний запуск у двох терміналах
```bash
# Термінал 1: Запуск API
dotnet run --project LinqUp.API --launch-profile https

# Термінал 2: Запуск Web
dotnet run --project LinqUp.Web --launch-profile https
```

### 4. Адреси сервісів
- 🌐 **Web-інтерфейс**: [https://localhost:7220](https://localhost:7220)
- 🔌 **REST API**: [https://localhost:7104](https://localhost:7104)
- 📖 **OpenAPI специфікація**: [https://localhost:7104/openapi/v1.json](https://localhost:7104/openapi/v1.json)

---

## ⚙️ Конфігурація

Основні параметри налаштовуються у файлах `appsettings.json` або за допомогою `dotnet user-secrets`:

```json
{
  "Jwt": {
    "Issuer": "LinqUp",
    "Audience": "LinqUp.Clients",
    "SigningKey": "YOUR_SUPER_SECRET_SIGNING_KEY_32_BYTES_MIN",
    "AccessTokenMinutes": 60,
    "RefreshTokenDays": 30
  },
  "Resend": {
    "ApiKey": "YOUR_RESEND_API_KEY",
    "FromAddress": "LinqUp <onboarding@resend.dev>",
    "WebBaseUrl": "https://localhost:7220"
  },
  "Cors": {
    "AllowedOrigins": [ "https://localhost:7220", "http://localhost:5220" ]
  }
}
```

> **Порада щодо безпеки**: Для локальної розробки використовуйте User Secrets, щоб не комітити справжні ключі в репозиторій:
> ```bash
> dotnet user-secrets set "Jwt:SigningKey" "YourStrongKeyHere1234567890123456" --project LinqUp.API
> ```

---

## 🛠️ Шпаргалка команд `just`

Якщо у вас встановлено утиліту `just`, доступні швидкі команди:

| Команда | Опис |
| ------- | ---- |
| `just` або `just run` | Одночасно запускає API та Web-застосунок |
| `just api` | Запускає лише сервіс `LinqUp.API` (`https://localhost:7104`) |
| `just web` | Запускає лише клієнт `LinqUp.Web` (`https://localhost:7220`) |
| `just build` | Збирає все рішення `LinqUp.slnx` |
| `just test` | Запускає юніт- та інтеграційні тести |

---

## 🗺️ План розвитку / Roadmap

- [x] Початкова архітектура на .NET 10 та EF Core
- [x] Хешування паролів Argon2id та сесії з відкликанням
- [x] Створення проєктів, каналів та SignalR чат
- [x] Відеоконференції на базі LiveKit WebRTC
- [x] Синхронізація з GitHub (репозиторії, PRs)
- [x] Двомовний інтерфейс (EN / UK)
- [ ] Мобільний додаток `LinqUp.Mobile` (.NET MAUI / Flutter)
- [ ] Push-сповіщення у браузері (WebPush)
- [ ] AI-помічник для формування структури завдань проєкту

---

## 🤝 Спільнота та внесок

Ми раді будь-якому внеску у розвиток LinqUp!
Перед початком співпраці, будь ласка, ознайомтеся з наступними документами:
- 📖 [Інструкція для контриб'юторів (CONTRIBUTING.md)](CONTRIBUTING.md) — як налаштувати середовище, правила стилю коду та процес оформлення PR.
- 📜 [Кодекс поведінки (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md) — стандарти нашої спільноти.
- 🔒 [Політика безпеки (SECURITY.md)](SECURITY.md) — відповідальне розкриття вразливостей.

---

## 📄 Ліцензія / License

Цей проєкт поширюється на умовах ліцензії [MIT](LICENSE).

---

<div align="center">
  Зроблено з любов'ю до відкритого коду та командної роботи 💙💛 <br />
  <sub><b>LinqUp Platform &copy; 2026</b></sub>
</div>
