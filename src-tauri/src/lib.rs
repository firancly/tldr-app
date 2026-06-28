use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use window_vibrancy::apply_acrylic;

#[tauri::command]
fn apply_glass_effect(window: tauri::WebviewWindow) -> Result<(), String> {
    apply_acrylic(&window, Some((20, 20, 24, 0))).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![apply_glass_effect])
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_shortcuts(["f9", "f10"])
            .expect("Failed to parse shortcut string")
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Released {
                    if shortcut.matches(Modifiers::empty(), Code::F9) {
                        let _ = app.emit("shortcut-triggered", "summarize");
                    } else if shortcut.matches(Modifiers::empty(), Code::F10) {
                        let _ = app.emit("shortcut-triggered", "enhance");
                    }
                }
            })
            .build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_user_input::init())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}