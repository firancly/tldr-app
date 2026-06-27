use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_shortcuts(["alt+s", "alt+e"])
            .expect("Failed to parse shortcut string")
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if shortcut.matches(Modifiers::ALT, Code::KeyS) {
                        let _ = app.emit("shortcut-triggered", "summarize");
                    } else if shortcut.matches(Modifiers::ALT, Code::KeyE) {
                        let _ = app.emit("shortcut-triggered", "enhance");
                    }
                }
            })
            .build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_user_input::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}