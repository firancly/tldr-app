use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use window_vibrancy::apply_acrylic;

#[tauri::command]
fn apply_glass_effect(window: tauri::WebviewWindow) -> Result<(), String> {
    apply_acrylic(&window, Some((20, 20, 24, 0))).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![apply_glass_effect, summarize_text])
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
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
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_user_input::init())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Serialize)]
struct GroqMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<GroqMessage>,
}

#[derive(Deserialize)]
struct GroqResponseMessage {
    content: String,
}

#[derive(Deserialize)]
struct GroqChoice {
    message: GroqResponseMessage,
}

#[derive(Deserialize)]
struct GroqResponse {
    choices: Vec<GroqChoice>,
}

#[tauri::command]
async fn summarize_text(text: String, mode: String) -> Result<String, String> {
    let api_key = std::env::var("GROQ_API_KEY").map_err(|_| "GROQ_API_KEY not set".to_string())?;

    let system_prompt = if mode == "enhance" {
        "You rewrite text to be clearer and more polished, keeping the original meaning. Reply with only the rewritten text, no preamble."
    } else {
        "You summarize text concisely in 1-3 sentences. Reply with only the summary, no preamble."
    };

    let body = GroqRequest {
        model: "llama-3.1-8b-instant".to_string(),
        messages: vec![
            GroqMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            GroqMessage {
                role: "user".to_string(),
                content: text,
            },
        ],
    };

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let parsed: GroqResponse = res.json().await.map_err(|e| e.to_string())?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "No response from Groq".to_string())
}
