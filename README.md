# SNAP

Select text anywhere on Windows, hit a hotkey, and get an AI result in a floating glass popup right next to your cursor. No copy pasting into a browser tab, no breaking your flow.

### [Download the latest release](https://github.com/firancly/tldr-app/releases/latest)

## Demo

<img width="400" height="407" alt="Enhance running on a sick-day email" src="https://github.com/user-attachments/assets/71f353e0-d5d0-4a14-a8fc-90088c737db3" />
<img width="400" height="235" alt="Summarize running on a Wikipedia article" src="https://github.com/user-attachments/assets/17ef3604-c404-4026-8950-d6dda815ce30" />
<p>
  <!-- mp4 version -->
  <!-- <img width="400" height="235" alt="Summarize demo" src="https://github.com/user-attachments/assets/fa95a296-d280-4687-835c-05fd2ddc3439" /> -->
  <!-- gif version -->
  <img width="400" height="214" alt="Popup appearing at the cursor" src="https://github.com/user-attachments/assets/c1704a05-8ec3-4673-878c-19318a4db89a" />
</p>

## Features

- **Summarize** (`F9` by default): turns selected text into a few short bullet points.
- **Enhance** (`F10` by default): rewrites text to read clearer and more polished while keeping the same meaning.
- **Ask anything**: don't want a preset? Select text, open the popup, and type your own instruction. Translate it, explain it, make it shorter, whatever you need.
- **Floating popup**: shows up right at your cursor with a real acrylic glass blur, and resizes smoothly as the response streams in.
- **One-click copy**: send the result straight back to your clipboard.
- **Configurable hotkeys**: change either binding from the main window, no restart needed.
- **Lives in the tray**: closing the main window just hides it, and it keeps listening for your hotkeys in the background.

## Getting started

Once you've installed and launched Snap, it runs quietly in the background instead of opening a window, so it's easy to think nothing happened. It's actually sitting in your system tray, ready to go.

1. Install and run Snap. Nothing visible opens, that's expected.
2. Look at the bottom right of your taskbar, near the clock. Click the small arrow (`^`) to show hidden icons.
3. Find the Snap icon there. Left-click it to open the main window, or right-click for options like Show and Quit.
4. Snap is already listening for hotkeys even with no window open. Go select some text in any app and press `F9` to summarize or `F10` to enhance.

That's it. You don't need to keep the window open, Snap keeps running in the tray and responds to your hotkeys from anywhere.

## How it works

1. Select any text in any app.
2. Press the hotkey for the action you want. (Default hotkeys: F9, F10, F11)
3. Snap quietly copies your selection, sends it to Groq, and shows the result in a popup near your cursor. Your existing clipboard is restored afterward so nothing gets clobbered.
4. To change your hotkeys, API key, or summary length, left click the Snap icon in the tray to open the main window. All the settings live there.

The Groq call runs entirely on the Rust side, so your API key never ends up in the frontend bundle.

## Setup (for development)

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

Most people should just [download the release](https://github.com/firancly/tldr-app/releases/latest) above. This is for contributors, anyone building on a non-Windows platform, or anyone who wants to verify the binary themselves.

```bash
npm run tauri build
```

This produces an NSIS installer (and an MSI) in `src-tauri/target/release/bundle/`. That's the file to hand out. It bundles the WebView2 runtime check, so it works on machines that don't already have it.

## Roadmap

- **Translate**: translate selected text into a target language you set.
- General polish as it comes up.

## AI usage

I wrote the code myself, but I leaned on AI a fair bit while doing it. This was my first time touching Rust or Tauri, so when I got stuck I'd use it to point me at the right docs, help me track down bugs, and explain stuff I didnt understand yet. I also used it to actually get the app building for Mac and Linux, since I only had Windows to work with and had no idea how the cross platform side worked. The decisions about what to build and how it all fits together were mine.

## Tech stack

- [Tauri v2](https://tauri.app): Rust backend, native window, shortcut, and clipboard APIs.
- [React](https://react.dev) + TypeScript: popup and settings UI.
- [Groq](https://groq.com) (`llama-3.1-8b-instant`): powers summarize and enhance.
- [window-vibrancy](https://github.com/tauri-apps/window-vibrancy): native acrylic blur.
