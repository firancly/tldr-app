use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            // .with_shortcuts(["alt+shift+s", "alt+shift+e"])
            // .expect("Failed to parse shortcut string")
            // .with_handler(|app, shortcut, event| {
            //     if event.state == ShortcutState::Released {
            //         if shortcut.matches(Modifiers::ALT | Modifiers::SHIFT, Code::KeyS) {
            //             let _ = app.emit("shortcut-triggered", "summarize");
            //         } else if shortcut.matches(Modifiers::ALT | Modifiers::SHIFT, Code::KeyE) {
            //             let _ = app.emit("shortcut-triggered", "enhance");
            //         }
            //     }
            // })
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