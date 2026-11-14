# 7 Days to Die Protocol

This protocol is the editable **7 Days to Die V3.4** preset for The Game Master. Its source file is:

`presets/7-days-to-die-v3.4-protocol.json`

It can be imported directly from the **Import Game Library (JSON)** screen. The file contains one game; the importer accepts either a single object or a complete library.

## Category structure

Each category represents one game setting and must have a unique `id`, a name, and at least two outcomes:

```json
{
  "id": "cat-example",
  "name": "[World] Example Setting",
  "options": [
    { "id": "opt-example-default", "label": "Default", "rank": "D" },
    { "id": "opt-example-hard", "label": "Hard", "rank": "B" }
  ]
}
```

The RNG does not use rank as a weight. Every option within a category retains the same probability. Ranks only describe difficulty and support global safety limits.

## Recommended rank scale

- `F`: a major advantage for the player.
- `E`: slightly easier than the default value.
- `D`: default or neutral behavior.
- `C`: noticeable but manageable difficulty.
- `B`: a severe restriction that remains sustainable.
- `A`: an extreme condition that should be combined carefully.
- `S`: an exceptional hazard capable of defining the entire run.

## Protocol constraints

The `constraints` object protects playability through four mechanisms:

1. `maxAttempts`: maximum attempts allowed when finding a valid configuration.
2. `rankLimits`: no more than 4 S-rank results and 15 combined A/S-rank results.
3. `forbiddenCombinations`: options that must never appear together.
4. `numericSums`: the five biome percentages must total exactly 100%.

The current constraints prevent cases such as:

- disabling both ranged and melee damage;
- disabling both block and terrain damage;
- losing two primary movement modes;
- combining headshot-only enemies with a zero headshot multiplier;
- generating a world with neither towns nor wilderness POIs;
- disabling both mining and general resource yield;
- combining daily blood moons, 64 zombies, and nightmare speed;
- disabling food loot, crop yield, and trading at the same time;
- starting with zero skill points and no way to gain XP.

## Unrestricted RNG mode

The protocol card displays an **UNRESTRICTED RNG** checkbox. When it is disabled, all protocol constraints apply. When it is enabled:

- every category is rolled independently without filtering outcomes;
- option ranks still do not alter selection probabilities;
- the final dossier warns that playability was not guaranteed;
- if the result violates configured rules, the dossier lists every violation.

The checkbox only affects the next sequence launched from that card. It does not modify or remove constraints stored in the JSON.

## Fast mode

Enable **FAST MODE** to generate the entire protocol and open the final dossier immediately. This skips all reel animations and removes the need to confirm each of the 152 categories individually.

Fast mode does not change randomness or safety behavior:

- with **UNRESTRICTED RNG** disabled, all playability guardrails remain active;
- with **UNRESTRICTED RNG** enabled, the full result is unfiltered and the final dossier audits violations;
- the generated results are identical in structure to a manually advanced sequence.

## Application checklist

The final dossier includes one **APPLIED** checkbox per mandate, a live progress counter, and controls to mark or clear the complete list. Use it while applying the generated setup.

The **Copy Run Dossier** action exports every mandate as a Markdown checklist item (`- [ ]`), so progress can also be tracked in any Markdown-compatible notes application.

## Minimum severity generation

Enable **MINIMUM SEVERITY** on the game card and enter a target from `1.00` to `7.00`. The engine generates complete plans until `Run Difficulty Rating >= target`. Enabling this mode automatically forces **UNRESTRICTED RNG** and bypasses every configured playability safeguard. The final dossier audits and lists any violated guardrails.

This feature is labeled **EXPERIMENTAL // BYPASSES ALL SAFEGUARDS // MAY FREEZE THE APPLICATION**. Generation currently evaluates retries synchronously, so an unlikely target can make the browser temporarily unresponsive until a qualifying plan is found or the attempt limit is reached.

The engine rejects a target above the theoretical maximum of the available option ranks. It also stops after 10,000 valid plan attempts and reports an actionable error instead of freezing the application. The final dossier records the requested target and the number of complete plans evaluated.

## SandboxCode output

For this protocol, the final dossier generates a copyable **V3.4 SandboxCode**. Paste it into the in-game Sandbox Options code field or into the `SandboxCode` property in `serverconfig.xml`.

The generator only encodes decisions that have an exact representation in the V3.4 Sandbox option schema. World generation, multiplayer session properties, and any protocol value that is not available in the game are labeled **MANUAL SETUP** and remain visible in the checklist. Never assume that a manual item was included in the code.

## Values used by numeric sums

Options participating in `numericSums` require a `constraintValue`:

```json
{
  "id": "opt-biome-forest-20",
  "label": "20%",
  "rank": "D",
  "constraintValue": 20
}
```

Do not remove `constraintValue` from a biome option while its category remains part of the numeric sum rule.

## Protocol editing workflow

1. Edit `presets/7-days-to-die-v3.4-protocol.json`.
2. Keep every category and option ID unique.
3. If a referenced option is removed, update `constraints` as well.
4. Synchronize the example library:

   ```powershell
   node scripts/sync-7dtd-protocol.mjs
   ```

5. Build the application with Node 22 or newer:

   ```powershell
   node build.mjs
   ```

6. Import the JSON and run several test sequences.

To extract the protocol from the example library again:

```powershell
node scripts/sync-7dtd-protocol.mjs --extract
```

## Checklist for new options

- The option exists in the targeted 7 Days to Die version or mod.
- Its rank represents cumulative impact, not only isolated difficulty.
- An A- or S-rank option does not remove an essential mechanic by itself.
- Dangerous combinations have a corresponding `forbiddenCombinations` rule.
- Related numeric categories retain at least one valid configuration.
- The protocol can find valid results without exhausting `maxAttempts`.
