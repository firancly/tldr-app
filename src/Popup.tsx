import { useEffect, useState, useRef } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Clipboard, CheckIcon } from "lucide-react";

interface ResultPayload {
  text: string;
  mode: string;
}

export default function Popup() {
  const [data, setData] = useState<ResultPayload | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState(""); // store input prompt
  const [customResult, setCustomResult] = useState(""); // AI response
  const [displayedCustomResult, setDisplayedCustomResult] = useState("");

  const handleCopy = async () => {
    await writeText(displayedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Get payload
  useEffect(() => {
    let unlistenResult: () => void;
    let unlistenCustom: () => void;

    const setup = async () => {
      unlistenResult = await listen<ResultPayload>("result-ready", (event) => {
        setData(event.payload);
        setCustomPrompt("");
        setSubmittedPrompt("");
        setCustomResult("");
      });

      unlistenCustom = await listen<{ text: string }>(
        "custom-result-ready",
        (event) => {
          setCustomResult(event.payload.text);
        },
      );

      await invoke("apply_glass_effect");
      await emit("popup-ready");
    };

    setup();

    return () => {
      if (unlistenResult) unlistenResult();
      if (unlistenCustom) unlistenCustom();
    };
  }, []);

  // Close window on focus changed
  useEffect(() => {
    let unlisten: () => void;

    const setup = async () => {
      let hideTimeout: ReturnType<typeof setTimeout> | null = null;

      unlisten = await getCurrentWindow().onFocusChanged(
        ({ payload: focused }) => {
          if (!focused) {
            hideTimeout = setTimeout(() => {
              getCurrentWindow().hide();
            }, 150);
          } else {
            if (hideTimeout) {
              clearTimeout(hideTimeout);
              hideTimeout = null;
            }
          }
        },
      );
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!data?.text || data.mode === "custom") return;

    setDisplayedText("");
    let i = 0;

    const interval = setInterval(() => {
      i++;
      setDisplayedText(data.text.slice(0, i));
      if (i >= data.text.length) {
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    if (!customResult) return;
    setDisplayedCustomResult("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedCustomResult(customResult.slice(0, i));
      if (i >= customResult.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [customResult]);

  // Window animation
  const lastResizeRef = useRef(0);
  const currentHeightRef = useRef(80);
  const animationFrameRef = useRef<number | null>(null);

  // To determine when to allow for drag so it doesn't break the resize animation
  const isAnimating =
    (data?.mode !== "custom" &&
      displayedText.length < (data?.text.length ?? 0)) ||
    (data?.mode === "custom" &&
      displayedCustomResult.length < customResult.length);

  function animateResize(targetHeight: number, duration = 250) {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startHeight = currentHeightRef.current;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const height = startHeight + (targetHeight - startHeight) * eased;

      getCurrentWindow().setSize(new LogicalSize(320, height));
      currentHeightRef.current = height;

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!contentRef.current) return;

    const isDone =
      displayedText.length === (data?.text.length ?? displayedText.length);
    const now = Date.now();

    if (!isDone && now - lastResizeRef.current < 100) return;
    lastResizeRef.current = now;

    const height = Math.min(500, Math.max(80, contentRef.current.scrollHeight));
    animateResize(height);
  }, [displayedText, data, customPrompt, displayedCustomResult]);

  // Esc to close popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().hide();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label =
    data?.mode === "enhance"
      ? "Enhanced"
      : data?.mode === "custom"
        ? "Ask AI"
        : "Summary";

  const dotColor =
    data?.mode === "enhance"
      ? "#a78bfa"
      : data?.mode === "custom"
        ? "#60a5fa"
        : "#50c878";

  return (
    <div
      {...(!isAnimating ? { "data-tauri-drag-region": true } : {})}
      ref={contentRef}
      style={{
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: 20,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#f4f4f5",
        background:
          "linear-gradient(160deg, rgba(30, 30, 34, 0.55) 0%, rgba(22, 22, 24, 0.55) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
      }}
    >
      <div
        {...(!isAnimating ? { "data-tauri-drag-region": true } : {})}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 12,
          marginBottom: 14,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: dotColor,
              boxShadow: `0 0 8px ${dotColor}`,
            }}
          />
          {label}
        </span>

        {data?.mode !== "custom" && (
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy"}
            style={{
              background: copied
                ? "rgba(80, 200, 120, 0.18)"
                : "rgba(255, 255, 255, 0.06)",
              border: `1px solid ${
                copied
                  ? "rgba(80, 200, 120, 0.45)"
                  : "rgba(255, 255, 255, 0.14)"
              }`,
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              width: 34,
              height: 34,
              padding: 0,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              transition:
                "background 0.15s, border-color 0.15s, transform 0.1s",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.92)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {/* {copied ? "✅" : "📋"} */}
            {copied ? (
              <CheckIcon style={{ width: "1.3em", height: "1.3em" }} />
            ) : (
              <Clipboard style={{ width: "1.3em", height: "1.3em" }} />
            )}
          </button>
        )}
      </div>

      {data?.mode === "custom" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {submittedPrompt ? (
            <div
              style={{
                background: "rgba(96, 165, 250, 0.12)",
                border: "1px solid rgba(96, 165, 250, 0.25)",
                borderRadius: "12px 12px 4px 12px",
                padding: "6px 10px",
                fontSize: 13,
                color: "rgba(244,244,245,0.85)",
                alignSelf: "flex-end",
                maxWidth: "85%",
              }}
            >
              {submittedPrompt}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "rgba(244,244,245,0.45)",
              }}
            >
              Selected: {data.text.slice(0, 80)}
              {data.text.length > 80 ? "..." : ""}
            </p>
          )}

          {submittedPrompt && !customResult && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "rgba(244,244,245,0.45)",
              }}
            >
              Thinking...
            </p>
          )}
          {customResult && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.65,
                color: "rgba(244,244,245,0.85)",
                whiteSpace: "pre-wrap",
              }}
            >
              {displayedCustomResult}
            </p>
          )}

          <input
            autoFocus
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customPrompt.trim()) {
                console.log("submit:", customPrompt, data.text);
                setSubmittedPrompt(customPrompt.trim());
                setCustomPrompt("");
                setCustomResult("");
                emit("custom-prompt-submit", {
                  prompt: customPrompt.trim(),
                  selectedText: data.text,
                });
              }
            }}
            placeholder="Ask anything about the selected text..."
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 8,
              color: "#f4f4f5",
              fontSize: 14,
              padding: "8px 12px",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: "rgba(244, 244, 245, 0.82)",
            whiteSpace: "pre-wrap",
          }}
        >
          {displayedText}
        </p>
      )}
    </div>
  );
}
