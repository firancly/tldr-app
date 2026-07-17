import { useEffect, useState } from "react";
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
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { load, Store } from "@tauri-apps/plugin-store";

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
  // const [hotkeys, setHotkeys] = useState({
  //   summarize: "F9",
  //   enhance: "F10",
  //   custom: "F11",
  // });

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
    dragDropEnabled: true,
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

// ---- Settings ----

type SummaryLength = "short" | "medium" | "long";

interface Hotkeys {
  summarize: string;
  enhance: string;
  custom: string;
}

interface Settings {
  apiKey: string;
  summaryLength: SummaryLength;
  hotkeys: Hotkeys;
}

interface HistoryEntry {
  mode: string;
  text: string;
  timestamp: number;
}

const HISTORY_LIMIT = 50;

async function pushHistoryEntry(mode: string, text: string) {
  const s = await load("settings.json");
  const existing = (await s.get<HistoryEntry[]>("history")) ?? [];
  const next = [{ mode, text, timestamp: Date.now() }, ...existing].slice(
    0,
    HISTORY_LIMIT,
  );
  await s.set("history", next);
  await s.save();
  return next;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  summaryLength: "medium",
  hotkeys: { summarize: "F9", enhance: "F10", custom: "F11" },
};

// Convert a keyboard event into a shortcut string like "F9"
function eventToShortcut(e: React.KeyboardEvent): string | null {
  const code = e.code;

  // Ignore letter keys without modifiers
  if (
    code.startsWith("Control") ||
    code.startsWith("Shift") ||
    code.startsWith("Alt") ||
    code.startsWith("Meta")
  ) {
    return null;
  }

  let key: string;
  if (code.startsWith("Key"))
    key = code.slice(3); // KeyK => K
  else if (code.startsWith("Digit"))
    key = code.slice(5); // Digit1 => 1
  else key = code; // Modifier

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  parts.push(key);
  return parts.join("+");
}

function HotkeyCapture({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <input
      readOnly
      value={capturing ? "Press keys..." : value}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={(e) => {
        e.preventDefault();
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
          return;
        }
        const sc = eventToShortcut(e);
        if (sc) {
          onChange(sc);
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        background: capturing
          ? "rgba(96, 165, 250, 0.12)"
          : "rgba(255,255,255,0.07)",
        border: `1px solid ${
          capturing ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.14)"
        }`,
        borderRadius: 8,
        color: "#f4f4f5",
        fontSize: 14,
        padding: "8px 12px",
        outline: "none",
        width: 160,
        textAlign: "center",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    />
  );
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "history">(
    "settings",
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load settings
  useEffect(() => {
    const setup = async () => {
      const s = await load("settings.json");
      setStore(s);
      const apiKey = (await s.get<string>("apiKey")) ?? DEFAULT_SETTINGS.apiKey;
      const summaryLength =
        (await s.get<SummaryLength>("summaryLength")) ??
        DEFAULT_SETTINGS.summaryLength;
      const hotkeys =
        (await s.get<Hotkeys>("hotkeys")) ?? DEFAULT_SETTINGS.hotkeys;

      const savedHistory = (await s.get<HistoryEntry[]>("history")) ?? [];
      setHistory(savedHistory);

      const hasLaunched = await s.get<boolean>("hasLaunched");
      if (!hasLaunched) {
        await getCurrentWindow().show();
        await getCurrentWindow().setFocus();
        await s.set("hasLaunched", true);
        await s.save();
      }

      setSettings({ apiKey, summaryLength, hotkeys });
    };
    setup();
  }, []);

  const saveSettings = async () => {
    if (!store) return;
    try {
      await store.set("apiKey", settings.apiKey.trim());
      await store.set("summaryLength", settings.summaryLength);
      await store.set("hotkeys", settings.hotkeys);
      await store.save();

      await invoke("update_hotkeys", { hotkeys: settings.hotkeys });
      setStatus("Saved");
    } catch (err) {
      setStatus(`Error: ${err}`);
    }
    setTimeout(() => setStatus(null), 2000);
  };

  // Check for updates
  useEffect(() => {
    const checkUpdate = async () => {
      const update = await check();
      if (!update) return;
      const yes = confirm(`v${update.version} available. Install now?`);
      if (!yes) return;
      await update.downloadAndInstall();
      await relaunch();
    };

    checkUpdate();
  }, []);

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
          console.log("No new text copied â€” nothing selected?");
          return;
        }

        if (mode === "custom") {
          await showResultWindow(text, "custom");
          return;
        }

        await showResultWindow("Summarizing...", mode);

        try {
          const result = await invoke<string>("summarize_text", { text, mode });
          await emitTo("result", "result-ready", { text: result, mode });
          setHistory(await pushHistoryEntry(mode, result));
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

  // Listen to custom prompt
  useEffect(() => {
    let unlisten: () => void;

    const setup = async () => {
      unlisten = await listen("custom-prompt-submit", async (event) => {
        const { prompt, selectedText } = event.payload as {
          prompt: string;
          selectedText: string;
        };

        try {
          const result = await invoke<string>("summarize_text", {
            text: selectedText,
            mode: "custom",
            customPrompt: prompt,
          });

          await emitTo("result", "custom-result-ready", { text: result });
          setHistory(await pushHistoryEntry("custom", result));
        } catch (err) {
          await emitTo("result", "custom-result-ready", {
            text: `Error ${err}`,
          });
        }
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const lengthOptions: { id: SummaryLength; label: string }[] = [
    { id: "short", label: "Short" },
    { id: "medium", label: "Medium" },
    { id: "long", label: "Long" },
  ];

  const hotkeyRows: { key: keyof Hotkeys; label: string; dot: string }[] = [
    { key: "summarize", label: "Summarize", dot: "#50c878" },
    { key: "enhance", label: "Enhance", dot: "#a78bfa" },
    { key: "custom", label: "Ask AI", dot: "#60a5fa" },
  ];

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(244,244,245,0.9)",
    marginBottom: 8,
    display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        minHeight: "100vh",
        overflow: "auto",
        boxSizing: "border-box",
        padding: "28px 24px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#f4f4f5",
        background: "linear-gradient(160deg, #1e1e22 0%, #161618 100%)",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
          Settings
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: "rgba(244,244,245,0.5)",
          }}
        >
          Configure hotkeys, your Groq API key, and summary length.
        </p>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "rgba(0,0,0,0.25)",
            borderRadius: 10,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {(["settings", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                background:
                  activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none",
                borderRadius: 8,
                color: activeTab === tab ? "#fff" : "rgba(244,244,245,0.7)",
                cursor: "pointer",
                padding: "8px 0px",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                transition: "background 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "history" && (
          <>
            {history.length === 0 ? (
              <div
                style={{
                  ...sectionStyle,
                  textAlign: "center",
                  color: "rgba(244,244,245,0.4)",
                  fontSize: 13,
                }}
              >
                No history yet.
              </div>
            ) : (
              <>
                {history.map((entry, i) => {
                  const dot =
                    hotkeyRows.find((r) => r.key === entry.mode)?.dot ??
                    "#9cf3af";
                  return (
                    <div
                      key={entry.timestamp + "-" + i}
                      onClick={() => writeText(entry.text)}
                      title="Click to copy"
                      style={{
                        ...sectionStyle,
                        cursor: "pointer",
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: dot,
                            boxShadow: `0 0 8px ${dot}`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: "capitalize",
                            color: "rgba(244,244,245,0.6)",
                          }}
                        >
                          {entry.mode}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(244,244,245,0.35)",
                            marginLeft: "auto",
                          }}
                        >
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "rgba(244,244,245,0.85)",
                          whiteSpace: "pre-wrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {entry.text}
                      </p>
                    </div>
                  );
                })}

                <button
                  onClick={async () => {
                    const s = await load("settings.json");
                    await s.set("history", []);
                    await s.save();
                    setHistory([]);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8,
                    color: "rgba(244,244,245,0.7)",
                    cursor: "pointer",
                    padding: "8px 14px",
                    fontSize: 13,
                  }}
                >
                  Clear History
                </button>
              </>
            )}
          </>
        )}

        {activeTab === "settings" && (
          <>
            {/* API key */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Groq API Key</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, apiKey: e.target.value }))
                  }
                  placeholder="gsk_..."
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8,
                    color: "#f4f4f5",
                    fontSize: 14,
                    padding: "8px 12px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8,
                    color: "#f4f4f5",
                    cursor: "pointer",
                    padding: "0 14px",
                    fontSize: 13,
                  }}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "rgba(244,244,245,0.4)",
                }}
              >
                Stored locally on your device. Leave blank to use the build's
                bundled key.
              </p>
            </div>

            {/* Summary length */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Summary Length</label>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 10,
                  padding: 4,
                }}
              >
                {lengthOptions.map((opt) => {
                  const active = settings.summaryLength === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setSettings((s) => ({ ...s, summaryLength: opt.id }))
                      }
                      style={{
                        flex: 1,
                        background: active
                          ? "rgba(96,165,250,0.9)"
                          : "transparent",
                        border: "none",
                        borderRadius: 8,
                        color: active ? "#fff" : "rgba(244,244,245,0.7)",
                        cursor: "pointer",
                        padding: "8px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        transition: "background 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hotkeys */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Hotkeys</label>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: 12,
                  color: "rgba(244,244,245,0.4)",
                }}
              >
                Click a field and press the key combination you want.
              </p>
              {hotkeyRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: row.dot,
                        boxShadow: `0 0 8px ${row.dot}`,
                      }}
                    />
                    {row.label}
                  </span>
                  <HotkeyCapture
                    value={settings.hotkeys[row.key]}
                    onChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        hotkeys: { ...s.hotkeys, [row.key]: v },
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            {/* Save */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 20,
              }}
            >
              <button
                onClick={saveSettings}
                disabled={!store}
                style={{
                  background: "rgba(96,165,250,0.95)",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  cursor: store ? "pointer" : "not-allowed",
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Save
              </button>
              {status && (
                <span
                  style={{
                    fontSize: 13,
                    color: status.startsWith("Error") ? "#f87171" : "#50c878",
                  }}
                >
                  {status}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
