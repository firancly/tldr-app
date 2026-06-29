# SNAP

Select text anywhere on Windows, hit a hotkey, get an AI result in a floating glass popup right next to your cursor. No copy-pasting into a browser tab, no breaking your flow.

## Demo

<!-- Drop your demo video/gif here -->

## Features

- **Summarize** (`F9` by default) — condenses selected text into 1-3 sentences.
- **Enhance** (`F10` by default) — rewrites text to be clearer and more polished, same meaning.
- **Translate** (`F11` by default) — translates selected text to a configurable target language. (To be implemented, maybe)
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

## Building a release

```bash
npm run tauri build
```

Produces an NSIS installer (and MSI) in `src-tauri/target/release/bundle/`. That's the file to hand out — it bundles the WebView2 runtime check, so it works on machines that don't already have it.

## Roadmap

- **Custom prompts** — let users write/edit the system prompt behind each action instead of the fixed built-in ones.
- **More language options for Translate** — dropdown/autocomplete instead of free-text input.
- **Esc to dismiss** — close the popup with a keypress, not just on focus loss.
- **Edge-of-screen-aware positioning** — clamp the popup so it never renders off-screen near a monitor edge.
- General QOL polish as it comes up.

## Tech stack

- [Tauri v2](https://tauri.app) — Rust backend, native window/shortcut/clipboard APIs
- [React](https://react.dev) + TypeScript — popup and settings UI
- [Groq](https://groq.com) (`llama-3.1-8b-instant`) — summarize/enhance/translate
- [window-vibrancy](https://github.com/tauri-apps/window-vibrancy) — native acrylic blur effect
