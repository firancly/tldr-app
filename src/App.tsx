import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export default function App() {
  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
      // Listen for the custom event we named in our Rust backend
      unlisten = await listen("shortcut-triggered", (event) => {
        console.log("🔥 Hotkey payload received in react:", event.payload);

        // more code here
      });
    };

    setupListener();

    // Clean up the listener when the component unmounts
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
        <p>Press Alt + S globally to test</p>
      </div>
    </div>
  );
}
