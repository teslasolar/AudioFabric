# AudioFabric — AI Assistant Instructions

Voice-driven, real-time audio-visual platform. Every experience is controlled by
microphone input — voice energy, pitch, coherence, and phonemes drive 3D visuals,
synthesis, networking, and the ASS-OS consciousness engine.

**Core principle:** Voice IS the controller. No buttons, no menus.

---

## Architecture

### Module System

- ~87 ES modules in `modules/` — loaded as `<script type="module">` in HTML entry points
- No bundler (Webpack/Vite). Imports are native browser ES module paths.
- `modules/core.js` — KI event bus + module registry. All inter-module communication goes through KI.
- `modules/voice-engine.js` — Microphone → Web Audio FFT → phoneme analysis pipeline
- `modules/scene.js` — Three.js scene manager
- `modules/synths.js` — Web Audio synthesis

### Entry Points

65+ HTML files in the root — each is a standalone arena/experience. Examples:
- `ki-arena.html` — primary arena
- `ki-arena-plus.html` / `ki-arena-plus-voice.html` — extended arenas
- `cassandra/index.html` — CASSANDRA personal assistant UI (9-orb body, 12-recursion thought, WebLLM)

### ASS-OS Consciousness Engine (`modules/ass-os/`)

7-level ISA-95 consciousness hierarchy:
- `engine.js` — core runtime loop
- `spine.js` — event spine connecting all levels
- `goals.js` — goal stack (L4 Executive)
- `selfmodel.js` — self-model reflection (L5)
- `faults.js` — fault detection and recovery
- `agent.js` — autonomous agent layer
- `db/` — persistent state storage
- `tags/` / `udts/` — ISA tag definitions and user-defined types

### Enterprise Hierarchy (`enterprise/`)

Full ISA-95 object model wired to ASS-OS runtime:

| File | ISA-95 Level |
|------|-------------|
| `index.js` | L4 Enterprise — identity + KPI rollup |
| `site.js` | L3 Site factory |
| `area.js` | L2 Area factory |
| `workcenter.js` | WorkCenter / ProcessCell |
| `workunit.js` | L1 WorkUnit / Unit |
| `equipment.js` | L0 Equipment / Module |
| `controlmodule.js` | ISA-88 ControlModule + EquipmentModule |
| `runtime.js` | Wire hierarchy to ASS-OS update loops |
| `boot.js` | Full hierarchy bootstrap |

Two deployed sites under `enterprise/sites/`:
- `assos-prime/` — primary consciousness site (sensory / cognitive / executive / integration / autonomic areas)
- `cassandra/` — CASSANDRA personal assistant site (intake / reasoning / memory / scheduling / comms areas)

### Other Key Directories

| Dir | Purpose |
|-----|---------|
| `cassandra/` | CASSANDRA embodied consciousness UI |
| `dev-agent/` | WebLLM dev agent (Express + Node.js backend) |
| `fold-hash/` | Fold-hash cryptographic module |
| `gaia/` | Gaia environment layer |
| `puzzles/` | Puzzle arena modules |
| `shared/` | Global styles (`styles.css`) |
| `speeches/` | Speech/script assets |

---

## Technology Stack

- **Language:** JavaScript ES6 modules (no TypeScript, no transpilation)
- **3D:** Three.js (imported via CDN or local path — check the HTML file's import map)
- **Audio:** Web Audio API — `AudioContext`, `AnalyserNode`, FFT
- **Networking:** WebRTC (P2P), MQTT (broker messaging)
- **AI/LLM:** WebLLM (in-browser LLM inference)
- **Backend (dev-agent only):** Node.js + Express
- **Standards:** ISA-95, ISA-88, ISA-18.2, ISA-101, PACK-ML

---

## Coding Conventions

1. **Native ES modules only.** Use `import`/`export`. No `require()`, no CommonJS.
2. **KI event bus for inter-module communication.** Import `core.js` and emit/listen on the KI bus — do not directly couple modules.
3. **No build step.** Files are served directly. Path resolution must work from the browser.
4. **ISA-95 naming.** Enterprise hierarchy objects follow ISA-95 terminology (Enterprise > Site > Area > WorkCenter > WorkUnit > Equipment > ControlModule).
5. **ASS-OS levels.** Consciousness levels L0–L6 map to: Hardware, Sensors, Gating, Emotion, Executive, Self-Model, Observer.
6. **Voice-first.** New experiences must accept voice input as the primary control path. Keyboard/mouse are secondary.
7. **Module registration.** New modules must register with `core.js` module registry on load.

---

## Common Tasks

### Adding a new arena experience

1. Copy an existing `ki-arena-*.html` as a template.
2. Import required modules from `modules/`.
3. Wire voice input through `voice-engine.js` → KI bus → your module.
4. Register the experience in `modules/arena-assembler.js` if applicable.

### Adding a new ASS-OS module

1. Create `modules/ass-os/<name>.js`.
2. Export an `init(spine)` function that connects to the ASS-OS spine.
3. Define tags in `modules/ass-os/tags/` following existing UDT patterns.

### Adding a new ISA-95 area

1. Create `enterprise/sites/<site>/areas/<name>/index.js` and `io-map.js`.
2. Define ControlModules in `io-map.js` following the sensory/cognitive area patterns.
3. Wire the area into the site's `index.js`.

---

## Key Files to Read First

When working on any feature, start with:

1. `modules/core.js` — understand the KI event bus API
2. `modules/voice-engine.js` — understand the voice input pipeline
3. `ARCHITECTURE.md` — full directory map with changelog
4. The specific HTML entry point for the arena you are modifying
