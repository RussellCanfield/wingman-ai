#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_logic;
mod commands;
mod hotkeys;
mod overlay;
mod platform;
mod speech;
mod state;
mod tray;

use tauri::Manager;
use tauri::RunEvent;

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    hotkeys::on_shortcut(app, shortcut, event.state());
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .manage(state::SharedState::default())
        .setup(|app| {
            tray::build_tray(&app.handle())?;
            if let Some(shared) = app.try_state::<state::SharedState>() {
                hotkeys::initialize_hotkeys(&app.handle(), &shared)?;
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::toggle_recording_with_window,
            commands::toggle_overlay,
            commands::set_gateway_url,
            commands::set_transcript,
            commands::clear_transcript,
            commands::hide_overlay,
            commands::set_hotkey_settings,
            commands::clear_quick_send,
            commands::queue_quick_send,
            commands::get_platform_profile,
            commands::get_permission_snapshot,
            commands::open_permission_settings,
            commands::send_notification,
            commands::send_test_notification
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Wingman desktop companion")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                if let Some(shared) = app.try_state::<state::SharedState>() {
                    speech::stop_capture(&shared);
                }
            }
        });
}
