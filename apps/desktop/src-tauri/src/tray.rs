use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::app_logic;
use crate::speech;
use crate::state::SharedState;

fn emit_state_changed<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("wingman://state-changed", ());
}

pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let toggle_recording =
        MenuItemBuilder::with_id("toggle_recording", "Start Recording").build(app)?;
    let toggle_overlay = MenuItemBuilder::with_id("toggle_overlay", "Toggle Overlay").build(app)?;
    let open_gateway_ui =
        MenuItemBuilder::with_id("open_gateway_ui", "Open Gateway UI").build(app)?;
    let open_settings = MenuItemBuilder::with_id("open_settings", "Settings...").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Wingman AI").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&toggle_recording)
        .item(&toggle_overlay)
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
                "open_settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    if let Some(state) = app.try_state::<SharedState>() {
                        speech::stop_capture(&state);
                    }
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(&app_handle)?;

    Ok(())
}
