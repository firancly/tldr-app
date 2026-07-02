use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;
use window_vibrancy::apply_acrylic;

const STORE_FILE: &str = "settings.json";

// Maps a current saved shortcut to its mode
struct HotkeyState {
    map: Mutex<HashMap<Shortcut, String>>,
}

fn default_hotkeys() -> [(&'static str, &'static str); 3] {
    [("summarize", "F9"), ("enhance", "F10"), ("custom", "F11")]
}

// Unregister everything then register the given hotkey
fn register_from_map(
    app: &AppHandle,
    state: &HotkeyState,
    hotkeys: HashMap<String, String>,
) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    let mut map = state.map.lock().unwrap();
    map.clear();

    for (mode, key) in hotkeys {
        if key.trim().is_empty() {
            continue;
        }
        let sc =
            Shortcut::from_str(&key).map_err(|e| format!("Invalid shortcut '{}': {}", key, e))?;
        gs.register(sc).map_err(|e| e.to_string())?;
        map.insert(sc, mode);
    }
    Ok(())
}

#[tauri::command]
fn apply_glass_effect(window: tauri::WebviewWindow) -> Result<(), String> {
    apply_acrylic(&window, Some((20, 20, 24, 0))).map_err(|e| e.to_string())
}

// Called by the settings UI after the user changes hotkeys
#[tauri::command]
fn update_hotkeys(
    app: AppHandle,
    state: State<HotkeyState>,
    hotkeys: HashMap<String, String>,
) -> Result<(), String> {
    register_from_map(&app, &state, hotkeys)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::from_path(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env")).ok();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            apply_glass_effect,
            summarize_text,
            update_hotkeys
        ])
        .setup(|app| {
            // Load saved hotkeys and register them
            let store = app.store(STORE_FILE)?;
            let saved = store.get("hotkeys");

            let mut hk: HashMap<String, String> = HashMap::new();
            for (mode, def) in default_hotkeys() {
                let key = saved
                    .as_ref()
                    .and_then(|v| v.get(mode))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| def.to_string());
                hk.insert(mode.to_string(), key);
            }

            app.manage(HotkeyState {
                map: Mutex::new(HashMap::new()),
            });
            let state = app.state::<HotkeyState>();
            if let Err(e) = register_from_map(app.handle(), &state, hk) {
                eprintln!("Failed to register hotkeys: {}", e);
            }

            let autostart = app.autolaunch();
            let _ = autostart.enable();
            Ok(())
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Released {
                        let state = app.state::<HotkeyState>();
                        let map = state.map.lock().unwrap();
                        if let Some(mode) = map.get(shortcut) {
                            let _ = app.emit("shortcut-triggered", mode.clone());
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_user_input::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
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
async fn summarize_text(
    app: AppHandle,
    text: String,
    mode: String,
    custom_prompt: Option<String>,
) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    // Prefer the user chosen key from settings then fall back to env
    let api_key = store
        .get("apiKey")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("GROQ_API_KEY").map(|s| s.to_string()))
        .or_else(|| std::env::var("GROQ_API_KEY").ok())
        .ok_or_else(|| "No API key set. Add your Groq API key in Settings.".to_string())?;

    let length = store
        .get("summaryLength")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "medium".to_string());

    let (system_prompt, user_prompt) = if mode == "enhance" {
        (
            r#"You rewrite the user's text to be clearer and better written while keeping their original meaning, intent, and tone. The result must read like a real person wrote it, not an AI.

                Hard rules:
                - Match the register of the input. Casual stays casual, formal stays formal. Do not make a casual message sound corporate.
                - Keep it roughly the same length. Do not pad or add sentences the user didn't imply.
                - No filler openers or closers like "I hope this finds you well", "Just wanted to reach out", "I wanted to take a moment". Get straight to the point.
                - Plain everyday words over fancy ones. "use" not "utilize", "help" not "facilitate", "about" not "regarding".
                - Vary sentence length. Mix short punchy sentences with longer ones the way people actually write.
                - Keep contractions (don't, I'm, you're). Dropping them sounds stiff.
                - Do not add enthusiasm, emojis, or politeness the user didn't put there.
                - Fix grammar, spelling, flow and clarity, but keep the person's voice.

                Reply with only the rewritten text. No preamble, no options, no quotes around it."#.to_string(),
            text.clone(),
        )
    } else if mode == "custom" {
        let prompt = custom_prompt.unwrap_or_default();
        (
            "You are a helpful AI assistant. Answer the user question about the provided text concisely and directly. No preamble.".to_string(),
            format!("Text:\n{}\n\nQuestion: {}", text, prompt),
        )
    } else {
        let length_rule = match length.as_str() {
            "short" => "- Output 1 to 2 bullet points. Be extremely concise.",
            "long" => "- Output 6 to 10 bullet points capturing all notable details.",
            _ => "- Output 2 to 5 bullet points. Use fewer for short text, more for long text.",
        };
        (
            format!(
                r#"You are a summarizer. Condense the user's text into short bullet points capturing only the key information.
            Rules:
            {}
            - Each bullet is one line, under 15 words, starting with "- ".
            - Lead each bullet with the most important word or idea so it can be skimmed.
            - No preamble, no title, no closing remarks. Output only the bullets.
            - Preserve critical specifics: names, numbers, dates, decisions, actions.
            - If the text is very short or already a single idea, reply with one sentence instead of bullets."#,
                length_rule
            ),
            text,
        )
    };

    let body = GroqRequest {
        model: "llama-3.1-8b-instant".to_string(),
        messages: vec![
            GroqMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            GroqMessage {
                role: "user".to_string(),
                content: user_prompt,
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

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_else(|_| "API error".to_string());
        return Err(err);
    }

    let parsed: GroqResponse = res.json().await.map_err(|e| e.to_string())?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "No response from Groq".to_string())
}
