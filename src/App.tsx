import { useEffect } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { key } from "tauri-plugin-user-input-api";
import { TrayIcon } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow, cursorPosition } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

async function silentCopy(
  maxAttempts = 10,
  intervalMs = 50,
): Promise<string | null> {
  const original = await readText().catch(() => "");
  const sentinel = "\u0000__tldr_copy_marker__\u0000";
  await writeText(sentinel);

  await key("KeyPress", "ControlLeft");
  await key("KeyClick", "KeyC");
  await key("KeyRelease", "ControlLeft");

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const after = await readText().catch(() => sentinel);
    if (after !== sentinel) {
      return after;
    }
  }

  await writeText(original).catch(() => {});
  return null;
}

async function showResultWindow(text: string, mode: string) {
  const pos = await cursorPosition();
  const payload = { text, mode };

  const existing = await WebviewWindow.getByLabel("result");
  if (existing) {
    await existing.setPosition(new PhysicalPosition(pos.x, pos.y));
    await existing.show();
    await existing.setFocus();
    await emitTo("result", "result-ready", payload);
    return;
  }

  const popup = new WebviewWindow("result", {
    url: "index.html?popup=true",
    x: pos.x,
    y: pos.y,
    width: 320,
    height: 200,
    decorations: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    shadow: false,
    transparent: true,
  });

  const unlistenReady = await listen("popup-ready", async () => {
    await popup.setPosition(new PhysicalPosition(pos.x, pos.y));
    await popup.setFocus();
    await emitTo("result", "result-ready", payload);
    unlistenReady();
  });

  popup.once("tauri://error", (e) => {
    console.error("Failed to create result window", e);
  });
}

export default function App() {
  // Setup Tray
  useEffect(() => {
    const setupTray = async () => {
      const icon = await defaultWindowIcon();

      // Setup menu for tray icon
      const menu = await Menu.new({
        items: [
          {
            id: "show",
            text: "Show",
            action: async () => {
              const win = getCurrentWindow();
              await win.show();
              await win.setFocus();
            },
          },
          {
            id: "quit",
            text: "Quit",
            action: () => exit(0),
          },
        ],
      });

      // Setup Tray Icon
      await TrayIcon.new({
        tooltip: "Span AI",
        icon: icon ?? undefined,
        menu,
        showMenuOnLeftClick: true,
        action: async (event) => {
          if (event.type === "Click" && event.button === "Left") {
            const win = getCurrentWindow();
            await win.show();
            await win.setFocus();
          }
        },
      });
    };

    setupTray();
  }, []);

  // Minimize to tray
  useEffect(() => {
    const setupCloseHandler = async () => {
      await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        await getCurrentWindow().hide();
      });
    };

    setupCloseHandler();
  }, []);

  // Listen to shortcuts
  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
      unlisten = await listen("shortcut-triggered", async (event) => {
        const mode = event.payload as string;
        const text = await silentCopy();
        if (!text) {
          console.log("No new text copied — nothing selected?");
          return;
        }

        console.log(text);
        await showResultWindow("Summarizing...", mode);

        try {
          const result = await invoke<string>("summarize_text", { text, mode });
          await emitTo("result", "result-ready", { text: result, mode });
        } catch (err) {
          await emitTo("result", "result-ready", {
            text: `Error: ${err}`,
            mode,
          });
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return (
    <div>
      <div>
        <h1>SNAP</h1>
        <p>Press Alt + Shift + S to test</p>
      </div>
    </div>
  );
}
