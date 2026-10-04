#!/usr/bin/env bash
set -e

echo "======================================="
echo "   Starting LinqUp Platform Services   "
echo "======================================="
echo "API: https://localhost:7104"
echo "Web: https://localhost:7220"
echo "Press Ctrl+C to terminate both services."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
    echo ""
    echo "Shutting down LinqUp services..."
    kill "$API_PID" "$WEB_PID" 2>/dev/null || true
    wait "$API_PID" "$WEB_PID" 2>/dev/null || true
    echo "All services stopped."
}

trap cleanup INT TERM EXIT

dotnet run --project "$SCRIPT_DIR/LinqUp.API" --launch-profile https &
API_PID=$!

dotnet run --project "$SCRIPT_DIR/LinqUp.Web" --launch-profile https &
WEB_PID=$!

wait
