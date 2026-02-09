use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::app_logic;
use crate::state::SharedState;

const SHOW_WINDOW_MENU_ID: &str = "show_window";
const OPEN_SETTINGS_MENU_ID: &str = "open_settings";

fn emit_state_changed<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("wingman://state-changed", ());
}

fn should_open_main_window(action_id: &str) -> bool {
    action_id == SHOW_WINDOW_MENU_ID || action_id == OPEN_SETTINGS_MENU_ID
}

fn ensure_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Wingman Companion")
        .inner_size(1240.0, 860.0)
        .resizable(true)
        .fullscreen(false)
        .build()?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let toggle_recording =
        MenuItemBuilder::with_id("toggle_recording", "Start Recording").build(app)?;
    let toggle_overlay = MenuItemBuilder::with_id("toggle_overlay", "Toggle Overlay").build(app)?;
    let show_window =
        MenuItemBuilder::with_id(SHOW_WINDOW_MENU_ID, "Show Wingman Window").build(app)?;
    let open_gateway_ui =
        MenuItemBuilder::with_id("open_gateway_ui", "Open Gateway UI").build(app)?;
    let open_settings =
        MenuItemBuilder::with_id(OPEN_SETTINGS_MENU_ID, "Settings...").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Wingman AI").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&toggle_recording)
        .item(&toggle_overlay)
        .item(&show_window)
        .item(&open_gateway_ui)
        .item(&open_settings)
        .separator()
        .item(&quit)
        .build()?;

    let app_handle = app.clone();
    let mut tray_builder = TrayIconBuilder::new().menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }
    tray_builder
        .tooltip("Wingman Companion")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "toggle_recording" => {
                    if let Some(state) = app.try_state::<SharedState>() {
                        let _ = app_logic::toggle_recording(app, &state);
                    }
                    emit_state_changed(app);
                }
                "toggle_overlay" => {
                    if let Some(state) = app.try_state::<SharedState>() {
                        let _ = app_logic::toggle_overlay(app, &state);
                    }
                    emit_state_changed(app);
                }
                "open_gateway_ui" => {
                    if let Some(state) = app.try_state::<SharedState>() {
                        if let Ok(guard) = state.0.lock() {
                            let target = if guard.gateway.ui_url.trim().is_empty() {
                                "http://127.0.0.1:18790".to_string()
                            } else {
                                guard.gateway.ui_url.clone()
                            };
                            if let Some(window) = app.get_webview_window("main") {
                                // Keep URL open behavior in-core without requiring shell/opener plugins.
                                if let Ok(target_json) = serde_json::to_string(&target) {
                                    let _ = window
                                        .eval(&format!("window.open({}, '_blank')", target_json));
                                }
                            }
                        }
                    }
                }
                id if should_open_main_window(id) => {
                    if let Err(error) = ensure_main_window(app) {
                        eprintln!("failed to open main window: {error}");
                    }
                }
                "quit" => {
                    if let Some(state) = app.try_state::<SharedState>() {
                        app_logic::stop_recording_for_shutdown(&state);
                    }
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(&app_handle)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{should_open_main_window, OPEN_SETTINGS_MENU_ID, SHOW_WINDOW_MENU_ID};

    #[test]
    fn recognizes_window_open_actions() {
        assert!(should_open_main_window(SHOW_WINDOW_MENU_ID));
        assert!(should_open_main_window(OPEN_SETTINGS_MENU_ID));
        assert!(!should_open_main_window("quit"));
    }
}
