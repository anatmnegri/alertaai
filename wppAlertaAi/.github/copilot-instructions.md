# AlertAi Workspace Instructions

## Project Summary

AlertAi is a small ASP.NET Core + Node.js workspace that listens to WhatsApp messages, sends the text to a C# triage API backed by Gemini, stores the result in SQLite, and pushes new occurrences to a SignalR dashboard.

## Core Flow

1. `whatsapp-bridge.js` listens to WhatsApp via Baileys.
2. `Program.cs` exposes `POST /api/triage` and `GET /api/ocorrencias`.
3. `GeminiTriageService.cs` classifies the message.
4. `wwwroot/index.html` shows the dashboard and receives realtime updates through `Hubs/EmergencyHub.cs`.

## Run Commands

- Backend: `dotnet run`
- Bridge: `npm start`

## Local Dev Ports

- Dev backend HTTP: `http://localhost:5019`
- Dev backend HTTPS: `https://localhost:7156`

The WhatsApp bridge should target the HTTP dev port unless a different `API_URL` is configured.

## Conventions

- Preserve the existing PT-BR naming used across models, services, and UI strings.
- Keep changes minimal and local to the owning layer.
- Prefer environment variables for runtime configuration when practical.
- Do not duplicate setup guidance that already belongs in `GEMINI.md`; link to it instead of restating it.

## Important Pitfalls

- The WhatsApp flow is self-chat based: the bridge should listen only to messages from the configured phone number chat.
- The bridge must avoid re-processing its own reply messages to prevent loops.
- `appsettings.json` currently contains development-only configuration and a Gemini API key placeholder/secret; avoid widening that surface unless the task requires it.
- The project uses SQLite with `EnsureCreated()` on startup, so there are no migrations to maintain yet.

## Useful References

- `GEMINI.md` for the operator guide.
- `Properties/launchSettings.json` for local URLs.
- `Program.cs` for API and SignalR wiring.