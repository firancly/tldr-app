# SNAP

Select text anywhere on Windows, hit a hotkey, get an AI result in a floating glass popup right next to your cursor. No copy-pasting into a browser tab, no breaking your flow.

### [⬇ Download the latest release](https://github.com/firancly/tldr-app/releases/latest)

## Demo

<img width="400" height="407" alt="Screen Recording 2026-06-29 145911" src="https://github.com/user-attachments/assets/71f353e0-d5d0-4a14-a8fc-90088c737db3" />
<img width="400" height="235" alt="Screen Recording 2026-06-29 145212" src="https://github.com/user-attachments/assets/17ef3604-c404-4026-8950-d6dda815ce30" />

## Features

- **Summarize** (`F9` by default) — condenses selected text into 1-3 sentences.
- **Enhance** (`F10` by default) — rewrites text to be clearer and more polished, same meaning.
- **Floating result popup** — appears right at your cursor, real acrylic glass blur, smooth animated resize as the response streams in.
- **One-click copy** — grab the result back to your clipboard instantly.
- **Configurable hotkeys** — change any of the two bindings from the main window, no restart needed.
- **Lives in the tray** — closing the main window just hides it; it keeps listening for hotkeys in the background.

## How it works

1. Select any text in any app.
2. Press the hotkey for the action you want.
3. The app silently copies your selection (without disturbing your existing clipboard if nothing was selected), sends it to Groq, and shows the result in a popup near your cursor.

The Groq API call happens entirely on the Rust side — your API key never touches the frontend bundle.

## Setup

```bash
npm install
```

Create `src-tauri/.env` with your [Groq API key](https://console.groq.com):

```
GROQ_API_KEY=your_key_here
```

Run in development:

```bash
npm run tauri dev
```

## Building from source

Most people should just [download the release](https://github.com/firancly/tldr-app/releases/latest) above. This is for contributors or anyone wanting to build on a non-Windows platform or verify the binary themselves.

```bash
npm run tauri build
```

Produces an NSIS installer (and MSI) in `src-tauri/target/release/bundle/`. That's the file to hand out — it bundles the WebView2 runtime check, so it works on machines that don't already have it.

## Roadmap

- **Custom prompts** — let users write/edit the system prompt behind each action instead of the fixed built-in ones.
- **Esc to dismiss** — close the popup with a keypress, not just on focus loss.
- **Edge-of-screen-aware positioning** — clamp the popup so it never renders off-screen near a monitor edge.
- General QOL polish as it comes up.
- **Translate** — translate selected text to a configurable target language.

## Tech stack

- [Tauri v2](https://tauri.app) — Rust backend, native window/shortcut/clipboard APIs
- [React](https://react.dev) + TypeScript — popup and settings UI
- [Groq](https://groq.com) (`llama-3.1-8b-instant`) — summarize/enhance
- [window-vibrancy](https://github.com/tauri-apps/window-vibrancy) — native acrylic blur effect
