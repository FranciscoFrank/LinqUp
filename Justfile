# Justfile for LinqUp solution

set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# Run both API and Web concurrently
default:
    @just run

# Run both API and Web projects concurrently
run:
    @{{ if os() == "windows" { "powershell -NoProfile -ExecutionPolicy Bypass -File ./run.ps1" } else { "./run.sh" } }}

# Run API only (https://localhost:7104)
api:
    dotnet run --project LinqUp.API --launch-profile https

# Run Web only (https://localhost:7220)
web:
    dotnet run --project LinqUp.Web --launch-profile https

# Build entire solution
build:
    dotnet build LinqUp.slnx

# Run tests
test:
    dotnet test
