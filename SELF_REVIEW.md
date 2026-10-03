# Final self-review

I traced create/join -> tutorial -> solo bot fill -> private clue relay -> submit -> timer -> optional Saboteur vote -> ten-depth win/loss -> leaderboard/debrief, plus reconnect, host loss, invalid input, and return-to-surface behavior.

## Fixes made after adversarial review
- **No answer leakage:** client state now contains only the current player's station clue, public crisis metadata, and the number of required actions. The authoritative solution and other station clues stay server-side.
- **Return to surface:** clears the reconnect token and room URL before reload, so a finished room is not automatically rejoined.
- **Chat injection:** UI renders player/chat strings with `textContent`; server strips control characters and enforces lengths.
- **Solo fairness:** with fewer than two humans, every empty station is filled by a scripted bot. Bots relay all missing station fragments, including later multi-step clues.
- **Simulation race:** the four-client script attaches its state listener before creating the room and uses the deterministic generator as its test oracle.
- **QR joining:** a self-contained QR encoder generates a real SVG invite code server-side; it was decoded successfully in local verification with OpenCV.
- **Saboteur voting:** Saboteur mode now opens a dedicated suspicion vote after every depth, with all-human completion or a 10-second fallback.
- **Daily leaderboard:** the end screen now fetches and renders the in-memory Daily Dive leaderboard.
- **Tutorial and audio:** added a skippable four-step interactive pressure drill and a low procedural WebAudio drone in addition to pings/alarms.
- **Contribution stats:** relay and ping counts now drive end-screen awards instead of player order.
- **Offline stations:** from depth 6, a deterministic station can go offline and its feed is rerouted into another station's clue; disconnected human stations are also relayed by automation.
- **Team Building:** the preset now gets longer timers and materially lower clue-noise probability.
- **Room codes:** codes are four letters only.

## Verification
- `node --check` passes for server, game, client, simulation, and QR modules.
- `npm test` passes 5/5 deterministic generator/reducer tests.
- The self-contained QR generated for `http://localhost:3000/?room=ABCD` successfully decoded back to that URL in OpenCV.
- This environment could not complete `npm install` because dependency installation timed out, so the Socket.IO four-client simulation could not be re-run here. The corrected script is included as `npm run simulate`; run it after `npm install` before deployment.

## Requirement audit
The build now includes 2-6 human stations; zero-account four-letter rooms, URL and QR joining; deterministic procedural crises and Daily Dive; scripted solo crewmates; chat jamming and 12 pings; optional hidden Saboteur with corrupted intel and voting; server authority; reconnect token; host migration; disconnect automation; room cleanup; validation; authoritative timers; Docker/Render/health endpoint; unit tests and a four-client simulation; CRT sonar visuals; damage effects; procedural WebAudio; remembered mute; mobile-first touch controls; keyboard/focus support; color/shape redundancy; reduced-motion toggle; tutorial; persistent guidance; About/How-to-Play; Daily leaderboard; contribution awards; share result; Team Debrief; Team Building preset; and OpenAI credit.
