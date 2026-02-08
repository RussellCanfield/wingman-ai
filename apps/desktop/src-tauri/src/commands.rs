use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

use crate::app_logic;
use crate::hotkeys;
use crate::platform::{self, PermissionSnapshot, PlatformProfile};
use crate::state::{AppState, SharedState};

#[tauri::command]
pub fn get_state(state: State<'_, SharedState>) -> Result<AppState, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn toggle_recording_with_window(
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<AppState, String> {
    app_logic::toggle_recording(&app, &state)
}

#[tauri::command]
pub fn toggle_overlay(app: AppHandle, state: State<'_, SharedState>) -> Result<AppState, String> {
    app_logic::toggle_overlay(&app, &state)
}

#[tauri::command]
pub fn set_gateway_url(url: String, state: State<'_, SharedState>) -> Result<AppState, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    guard.gateway.url = url.trim().to_string();
    Ok(guard.clone())
}

#[tauri::command]
pub fn set_transcript(
    transcript: String,
    state: State<'_, SharedState>,
) -> Result<AppState, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    guard.transcript = transcript;
    Ok(guard.clone())
}

#[tauri::command]
pub fn clear_transcript(state: State<'_, SharedState>) -> Result<AppState, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    guard.transcript.clear();
    Ok(guard.clone())
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle, state: State<'_, SharedState>) -> Result<AppState, String> {
    app_logic::hide_overlay(&app, &state)
}

#[tauri::command]
pub fn set_hotkey_settings(
    app: AppHandle,
    state: State<'_, SharedState>,
    record_hotkey: String,
    overlay_hotkey: String,
    quick_send_on_record_hotkey: bool,
) -> Result<AppState, String> {
    hotkeys::apply_hotkey_settings(
        &app,
        &state,
        record_hotkey,
        overlay_hotkey,
        quick_send_on_record_hotkey,
    )
}

#[tauri::command]
pub fn clear_quick_send(state: State<'_, SharedState>) -> Result<AppState, String> {
    app_logic::clear_quick_send_nonce(&state)
}

#[tauri::command]
pub fn queue_quick_send(state: State<'_, SharedState>) -> Result<AppState, String> {
    app_logic::queue_quick_send(&state)
}

#[tauri::command]
pub fn get_platform_profile() -> PlatformProfile {
    platform::profile()
}

#[tauri::command]
pub fn get_permission_snapshot() -> PermissionSnapshot {
    platform::permission_snapshot()
}

#[tauri::command]
pub fn open_permission_settings(permission_id: String) -> Result<(), String> {
    platform::open_permission_settings(&permission_id)
}

#[tauri::command]
pub fn send_notification(
    app: AppHandle,
    title: Option<String>,
    body: String,
) -> Result<(), String> {
    let resolved_title = title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Wingman Desktop".to_string());
    let resolved_body = body.trim().to_string();
    if resolved_body.is_empty() {
        return Err("Notification body cannot be empty.".to_string());
    }

    app.notification()
        .builder()
        .title(&resolved_title)
        .body(&resolved_body)
        .show()
        .map_err(|err| format!("Notification failed: {err}"))?;
    Ok(())
}

#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Wingman Desktop")
        .body("Notifications are enabled and working.")
        .show()
        .map_err(|err| format!("Notification test failed: {err}"))?;
    Ok(())
}
