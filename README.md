# The-Game-Master
An frontend project made to eliminate choice paralysis in video games.

---

## What It Does

Gamers frequently spend hours in configuration menus, mod managers, and character builders only to burn out before the run even starts. 

**The Game Master** takes control out of your hands. It forces an irreversible, uniform randomized mandate across your custom setup categories. There are no individual rerolls, no category locks, and no second chances: take the fate you are dealt, or forfeit the run entirely.

---

## Features

- **Strict Uniform Randomness ($1/N$):** Without preset constraints, every option inside a category has an identical chance of rolling. Ranks never alter selection odds.
- **Playability Guardrails:** A preset may cap dangerous ranks, reject incompatible option combinations, and require numeric settings (such as biome percentages) to reach a valid total. The engine draws complete uniform configurations until one satisfies every rule.
- **Explicit Unrestricted Override:** Guarded presets expose an `UNRESTRICTED RNG` checkbox. It bypasses guardrails for that run and adds a playability warning plus any violated rules to the final dossier.
- **Fast Mode:** Every game card exposes a `FAST MODE` checkbox that skips reel animations and per-category confirmation while preserving the exact same generated result and active guardrails.
- **Minimum Severity (Experimental):** Optionally require a minimum `Run Difficulty Rating` from `1.00` to `7.00`. Enabling it automatically bypasses every playability safeguard, rerolls complete unrestricted plans until the threshold is reached, and reports the attempt count and violated guardrails in the final dossier. Unlikely targets can temporarily freeze the application while synchronous retries are evaluated.
- **Application Checklist:** The final dossier provides one checkbox per mandate, live progress, bulk mark/clear controls, and Markdown checklist export.
- **7 Days to Die SandboxCode:** V3.4 protocol results include a copyable `SandboxCode`. Each checklist card is labeled `SANDBOX CODE` or `MANUAL SETUP`, so world-generation and server-only decisions remain explicit.
- **5-Second Vertical Tumbler:** A mechanical card-reel that accelerates and smoothly decelerates before snapping onto the center reticle.
- **F to S Difficulty Rating:** Options are mapped from **Tier F** (Trivial) to **Tier S** (Brutal Ordeal). The Arbiter aggregates your final score into an overall run severity grade.
- **Hazard Outlier Rule:** Rolling even a single S-tier constraint flags the entire run as hazardous and clamps the minimum run severity to B.
- **100% Offline & Portable:** Distributed as a single self-contained `.html` file. Zero installation, zero node modules, zero network calls.
- **Persistence:** Custom games, categories, and options save automatically to browser `localStorage`. Includes one-click JSON export/import to share packs with friends.

## Optional preset constraints

Game JSON may include a `constraints` object with:

- `rankLimits`: caps for one rank or a combined set of ranks.
- `forbiddenCombinations`: option ID sets that must never appear together.
- `numericSums`: category ID sets whose selected options' `constraintValue` fields must total a target.
- `maxAttempts`: safety limit for finding a valid configuration (default `20000`, maximum `100000`).

Constraints are validated during import and saved with the preset. Existing presets without this object keep their original behavior.

The maintained 7 Days to Die protocol is available at
`presets/7-days-to-die-v3.4-protocol.json`; editing and synchronization instructions are documented in
`docs/7-DAYS-TO-DIE-PROTOCOL.md`.

---

## How to Run

1. Download **`the-game-master.html`** directly from this repository or from the [Releases](releases) tab.
2. Double-click the `.html` file to open it in any modern web browser (Brave, Chrome, Firefox, Edge, Safari).
3. Hit **Begin Sequence** to roll a challenge, or click **Create New Game** to build your own pool.

---

## Controls

- `Space` / `Enter` — Pull Lever / Advance to Next Mandate
- Click **Forfeit** at any time to scrap the sequence and reset to the library.

---

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — Copyright 2026 Shizeya.
