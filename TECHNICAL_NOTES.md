# Technical Notes - Casino UI / Slot Engine Refresh

## Scope implemented
- Rewired the new premium casino shell in `gambling_slots.html` to fully work with `ui/gambling_slots.js`.
- Added shared runtime debug state rendering and developer controls.
- Improved shared spin pipeline consistency (state phases, debug traces, cap visibility).
- Tightened key game loops for `Six Six Six`, `Le Bandit`, and shared `Snoop` server-side config.

## What changed

### 1) Stake-style shell wiring
- `ui/gambling_slots.js`
  - Added rendering + click handling for:
    - `#gameMachineCategoryTabs`
    - `#gameMachineList`
    - `#gameRecentList`
  - Sidebar game list now follows the same category filtering as lobby.
  - Recent spins now populate both the history drawer and the sidebar recent panel.

### 2) Runtime state + developer panel
- `ui/gambling_slots.js`
  - Added:
    - `renderDevPanel()`
    - `updateRuntimeChips()`
    - debug log helper
  - Runtime chips (`State`, `Cap`) now update from live sequence state.
  - Developer settings and one-shot override controls now function:
    - dev mode toggle
    - force mode select
    - seed input
    - apply once

### 3) Global spin loop polish / controls
- `ui/gambling_slots.js`
  - Added keyboard support:
    - `Space` = spin / quick-skip
    - `S` = turbo toggle
    - `A` = autoplay start/stop
  - Added deterministic one-spin seed runner via temporary seeded `Math.random` scope.
  - Added debug trace collection for:
    - raw win
    - cap status
    - tumble count
    - feature queue hints

### 4) Cap math trace plumbing
- `economy/slots.js`
  - `clampPayoutForGame` now records cap metadata.
  - `spin(...)` now attaches `capInfo` and `rawPayoutWanted` to every returned result.
  - This allows UI debug panel to show cap clamp status reliably.

### 5) Snoop mechanics alignment updates
- `economy/slots.js`
  - `SNOOP_CFG.clusterMin` changed to `5` (was 6).
  - Free spins mapping updated:
    - `3 -> 10`
    - `4 -> 12`
    - `5 -> 15`
    - `6 -> 20`
  - Weed multiplier-cell bonus changed to `+2`.
  - Wild upgrade cap increased to `x100`.
  - Added `forceBonus` handling path for test/dev mode.

### 6) Six Six Six mechanics upgrades
- `ui/gambling_slots.js`
  - Base game now uses blue-wheel behavior (red disabled in base rules).
  - Bonus buy cost increased (`60x`).
  - Added Deal-with-the-Devil resolver for Tier A/B:
    - spin outcomes can award spins or upgrade tier
    - A->B upgrade can roll a second deal at B tier
    - no deal flow for top tier C
  - Deal results are surfaced in intro text/banner flow.
  - Added forced tier support (`forceTier: C`) for dev override.

### 7) Le Bandit loop rework
- `ui/gambling_slots.js`
  - Replaced old simplified simulation with a fuller loop:
    - cluster detection
    - super-cascade style removals
    - golden-square marking persistence
    - rainbow activation reveals (coin/clover/pot style)
    - cascade refill sequence
  - Added base tumble frames and richer bonus frame timeline.
  - Added force bonus route support for dev/testing.

## Known approximation areas
- Mechanics are implemented to match the intended behavior flow and pacing, but exact proprietary provider math tables/hidden weighting are not copied.
- Deal-with-the-Devil is implemented as a deterministic weighted flow in our own config (not provider assets/branding).
- Le Bandit Golden Square resolver is an original deterministic model with provider-inspired order of operations.

## Files touched
- `growtopia test/ui/gambling_slots.js`
- `growtopia test/economy/slots.js`
- `growtopia test/TECHNICAL_NOTES.md`
