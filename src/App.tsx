import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
// import { useRef } from "react";
import { key } from "tauri-plugin-user-input-api";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { TrayIcon } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";

export default function App() {
  // const countRef = useRef(0);

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
        console.log("Hotkey payload received in react:", event.payload);
        // countRef.current += 1;

        await key("KeyPress", "ControlLeft");
        await key("KeyClick", "KeyC");
        await key("KeyRelease", "ControlLeft");

        await new Promise((resolve) => setTimeout(resolve, 100));

        const text = await readText();
        console.log(text);
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
        <p>Press Alt + S to test</p>
      </div>
    </div>
  );
}
