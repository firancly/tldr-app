import { useEffect, useState, useRef } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

interface ResultPayload {
  text: string;
  mode: string;
}

export default function Popup() {
  const [data, setData] = useState<ResultPayload | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Get payload
  useEffect(() => {
    let unlisten: () => void;

    const setup = async () => {
      unlisten = await listen<ResultPayload>("result-ready", (event) => {
        setData(event.payload);
      });

      await invoke("apply_glass_effect");
      await emit("popup-ready");
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Close window on focus changed
  useEffect(() => {
    let unlisten: () => void;

    const setup = async () => {
      unlisten = await getCurrentWindow().onFocusChanged(
        ({ payload: focused }) => {
          if (!focused) {
            getCurrentWindow().close();
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
    if (!data?.text) return;

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

  const lastResizeRef = useRef(0);

  useEffect(() => {
    if (!contentRef.current) return;

    const isDone =
      displayedText.length === (data?.text.length ?? displayedText.length);
    const now = Date.now();

    if (!isDone && now - lastResizeRef.current < 100) return;
    lastResizeRef.current = now;

    const height = Math.min(500, Math.max(80, contentRef.current.scrollHeight));
    getCurrentWindow().setSize(new LogicalSize(320, height));
  }, [displayedText, data]);

  return (
    <div
      ref={contentRef}
      style={{
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        borderRadius: 16,
        overflow: "hidden",
        padding: 16,
        fontFamily: "sans-serif",
        color: "#fff",
      }}
    >
      <strong>{data?.mode === "enhance" ? "Enhanced" : "Summary"}</strong>
      <p>{displayedText}</p>
    </div>
  );
}
