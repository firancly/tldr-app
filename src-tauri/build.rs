fn main() {
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["apply_glass_effect", "summarize_text"]),
    );

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
