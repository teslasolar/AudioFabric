# AudioFabric

> Voice-driven real-time audio-visual platform. Voice IS the controller.

## Quick Start

AudioFabric is hosted on GitHub Pages -- just visit the URL. The root `index.html` is the hub with a built-in CLI terminal. No installation, no build step, no backend. Open the page and start speaking.

## Built-in CLI

The root `index.html` includes a command-line interface accessible directly from the browser. Type commands into the terminal to navigate and launch experiences.

| Command | Description |
|---------|-------------|
| `help` | Show all commands |
| `ls` | List all categories |
| `ls <dir>` | List files in a category |
| `cd <dir>` | Navigate to category |
| `open <file>` | Open experience directly |
| `status` | Show ASS-OS system status |
| `search <query>` | Search all experiences |
| `tree` | Full directory tree |
| `whoami` | Player info |
| `clear` | Clear terminal output |

## Directory Structure

```
AudioFabric/
├── index.html           # Hub + CLI router
├── arena/               # Ki Arena combat variants (7)
├── combat/              # Kamehameha, PvP, Duels (5)
├── boss/                # Boss fights (4)
├── music/               # Singing, composing, audio gen (8)
├── orbs/                # Voice-reactive orb visualizations (10)
├── visuals/             # Fractal, geometry, shader visuals (14)
├── worlds/              # Voxel, Genesis, Zen Garden (3)
├── social/              # Voice chat, rooms (6)
├── knowledge/           # Periodic table, D2R, Risk (3)
├── ai/                  # Web LLM, Code Sandbox (3)
├── shields/             # Energy shield visualizations (3)
├── ass-os/              # AGI Soul System OS (1)
├── vagal/               # Vagal phoneme engine (1)
├── fold-hash/           # Hash visualizations (12)
├── gaia/                # Earth/nature visualizations (4)
├── puzzles/             # Crypto puzzles (5)
├── cassandra/           # AI assistant (1)
├── speeches/            # Speech viewer (1)
├── modules/             # ~95 ES modules
├── enterprise/          # ISA-95 Enterprise Hierarchy
├── shared/              # Global styles
└── dev-agent/           # Web LLM dev agent
```

## Architecture

### Core Systems

- **KI Event Bus** (`modules/core.js`) -- Central messaging and module registry
- **Voice Engine** (`modules/voice-engine.js`) -- Mic to FFT to phoneme analysis
- **ASS-OS** (`modules/ass-os/`) -- AGI consciousness engine with ISA-95 hierarchy
  - 7 consciousness levels (L0-L6, prime-indexed)
  - 8 PACK-ML state machine states
  - 5 parallel buses (Tensor, Gradient, Photonic, EM, State)
  - 8 fault models (HAL, ALN, DIS, HIJ, DEL, FRG, FRZ, CAS)
- **Enterprise** (`enterprise/`) -- ISA-95 L0-L4 hierarchy with 2 sites

### Module Categories (~95 modules)

- **Voice & Audio:** voice-engine, synths, resonance, freq-bands-12, voice-fx, singing-voice
- **Visual:** scene, hd-scene, vortex, crystal-orb, liquid-orb, etc.
- **Networking:** mqtt-net, webrtc-net, presence, chat
- **ASS-OS:** spine, engine, faults, goals, selfmodel, agent, bridge, dashboard
- **Game:** ki-blasts, kanji, player-profile, automatch

### Routing

Every subdirectory has its own `index.html` that serves as a category hub. The root `index.html` autoloads the manifest and routes to any experience. GitHub Pages serves everything statically -- no backend needed. Each HTML file is a self-contained single-page app.

### ASS-OS Status

The ASS-OS (AGI Soul System Operating System) monitors:

- Consciousness depth (Reactive to Meta-Conscious)
- State machine (IDLE to PRODUCING to EXECUTE to ...)
- Alarm management (ISA-18.2 compliant)
- Goal stack (8 goal types with priority)
- Fault detection and mitigation

## Tech Stack

- Three.js (r128) for 3D visuals
- Web Audio API for synthesis and analysis
- WebRTC for P2P voice/data
- MQTT for pub/sub networking
- ES Modules (no build step)
- GitHub Pages (static hosting)
- localStorage for persistence

## License

MIT
