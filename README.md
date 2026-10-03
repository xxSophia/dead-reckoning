# DEAD RECKONING

**DEAD RECKONING** is a zero-account, real-time cooperative submarine game about communication under pressure. Two to six players each operate a different station and see only a fragment of the truth; they must relay clues, resolve procedural crises, and survive ten increasingly noisy depths. Solo players get scripted AI crewmates automatically, so the complete asymmetric-information loop works immediately for a judge, classroom facilitator, remote team, or group of friends.

## Screenshots

> **Hero / landing screenshot:** add `docs/landing.png` after deployment.

> **Live station screenshot:** add `docs/station.png` showing the CRT scope, crew chat, tactical pings, and action sequence.

> **Debrief screenshot:** add `docs/debrief.png` showing contribution awards and Team Debrief.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
# open http://localhost:3000
```

Tests and multiplayer smoke simulation:

```bash
npm test
npm run simulate
```

Health check: `GET /health`.

## Deploy

### Render
1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`, builds the included Dockerfile, and uses `/health` for health checks.
4. Open the generated HTTPS URL. No environment variables, database, API keys, or secrets are required.

### Docker anywhere
```bash
docker build -t dead-reckoning .
docker run -p 3000:3000 dead-reckoning
```

## Architecture

```mermaid
flowchart LR
  A[Mobile/Desktop Browser] <-- Socket.IO --> S[Node + Express Server]
  B[Other Crew Browser] <-- Socket.IO --> S
  C[Scripted AI Crewmates] --> S
  S --> R[In-memory Rooms]
  S --> G[Seeded Crisis Generator]
  S --> X[Authoritative Reducer]
  S --> L[In-memory Daily Leaderboard]
  S --> H[/health]
```

The server owns room membership, host identity, game state, crisis solutions, hull, depth, and submissions. Clients receive only their assigned station clue (never the solution or other private clues) and send validated intent messages. Reconnect uses an opaque locally stored token; a disconnected host migrates to the next online human. When fewer than two humans are present, all empty stations are filled by bots at dive start; disconnected stations are relayed by automation. Rooms without humans are cleaned up automatically.

## How to play

Create a room or choose **Play solo now**. Read the clue on your station, relay it, compare it with other stations, and choose the joint action sequence. `[STATIC]` means a clue may be corrupted. After depth 3, free chat is jammed and only twelve tactical pings remain. Wrong sequences cost 25% hull. Survive depth 10 to win.

A skippable four-step pressure drill teaches read → relay → agree → commit over the first live crisis while AI crewmates demonstrate the behavior. **Team Building** gives longer crisis timers and substantially lower clue-noise probability. **Daily Dive** uses a date-derived deterministic seed so crews can compare runs.

## Reliability and edge cases

Inputs are length-limited and validated server-side; invalid room codes and duplicate nicknames return friendly errors. The commit button debounces rapid double-clicks. Socket.IO heartbeat/reconnect handles transient latency and background tabs. Rejoining with the same token restores the station. A departing host migrates automatically; during an active dive the UI announces signal loss and station automation. Room cleanup removes abandoned sessions.

## Accessibility and polish

The interface uses high contrast, large touch targets, semantic controls, visible focus treatment, shape-plus-text tactical signals, and the operating system's `prefers-reduced-motion` setting. Visuals use pure CSS plus a generated SVG QR code: sonar sweep, CRT scan lines, damage shake, and alert lighting. WebAudio creates procedural pings, alarms, and a low submarine drone; mute preference is saved locally. No external image, font, analytics, or media assets are loaded.

## How it was built with OpenAI

OpenAI was used as a development partner for product framing, game-system design, deterministic generator/reducer implementation, multiplayer edge-case review, UI copy, automated tests, deployment scaffolding, and contest-oriented self-review. The shipped game has no OpenAI runtime dependency: AI crewmates are deterministic/scripted, so deployment needs no paid API or secret.

## Contest description (150 words)

DEAD RECKONING is a real-time cooperative submarine game where communication is the control system. Two to six players receive different station panels—Sonar, Navigation, Engine, Periscope, Comms, and Hull—and must combine incomplete, sometimes corrupted clues to survive ten procedural crises. After depth three, free chat fails and the crew must communicate through twelve tactical sonar pings, turning information loss into the game’s central mechanic. A deterministic generator powers replayable runs and a shared Daily Dive. Judges can experience the complete loop instantly: Play Solo Now fills missing stations with in-character scripted crewmates, with no accounts, APIs, or setup. The server is authoritative, reconnect-safe, and deploys from one repository with Docker and Render configuration. CRT sonar visuals, procedural WebAudio, mobile-first controls, accessibility settings, contribution awards, and an emoji share card provide polish. A post-game Team Debrief turns performance into practical feedback about clarity, confirmation, and communication under pressure for friends, classrooms, and remote teams.

## Cover image prompt

Create a cinematic 16:9 key art image for a game titled “DEAD RECKONING.” View from inside a damaged deep-sea submarine command station, nearly black ocean beyond thick glass, luminous cyan-green CRT sonar screens and one amber warning display, a sweeping circular radar beam, abstract mine contacts and depth marks, subtle red emergency illumination, condensation and analog instrument glow. Six distinct station silhouettes imply a distributed crew but show no identifiable faces. Mood: intelligent, tense, cooperative, abyssal, premium indie game. Strong central composition with negative space for the title, crisp geometric UI motifs, colorblind-safe cyan/amber/red accents, no logos, no copyrighted characters, no photoreal humans, no small illegible text. High contrast, atmospheric volumetric haze, restrained film grain, polished game-festival key art, 16:9.
