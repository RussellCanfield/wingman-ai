#[cfg(target_os = "macos")]
#[allow(deprecated)]
use objc2_foundation::{NSString, NSUserNotification, NSUserNotificationCenter};
use serde::Serialize;
#[cfg(target_os = "macos")]
use std::process::Command;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

use crate::app_logic;
use crate::hotkeys;
use crate::platform::{self, PermissionSnapshot, PlatformProfile};
use crate::state::{AppState, SharedState};

#[cfg(target_os = "macos")]
fn escape_applescript_literal(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

#[cfg(target_os = "macos")]
fn send_notification_via_osascript(title: &str, body: &str) -> Result<(), String> {
    let script = format!(
        "display notification \"{}\" with title \"{}\"",
        escape_applescript_literal(body),
        escape_applescript_literal(title)
    );
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|err| format!("Failed to launch osascript notification: {err}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() { stderr } else { stdout };
    if detail.is_empty() {
        return Err(format!(
            "osascript notification failed with status {}",
            output.status
        ));
    }
    Err(format!("osascript notification failed: {detail}"))
}

#[cfg(target_os = "macos")]
fn send_notification_via_nsusernotification(title: &str, body: &str) -> Result<(), String> {
    if body.trim().is_empty() {
        return Err("Notification body cannot be empty.".to_string());
    }

    #[allow(deprecated)]
    {
        let title_ns = NSString::from_str(title);
        let body_ns = NSString::from_str(body);
        let notification = NSUserNotification::new();
        notification.setTitle(Some(&title_ns));
        notification.setInformativeText(Some(&body_ns));
        let center = NSUserNotificationCenter::defaultUserNotificationCenter();
        center.deliverNotification(&notification);
    }

    Ok(())
}

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

    if app
        .notification()
        .builder()
        .title(&resolved_title)
        .body(&resolved_body)
        .show()
        .is_ok()
    {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        if send_notification_via_nsusernotification(&resolved_title, &resolved_body).is_ok() {
            return Ok(());
        }
        if tauri::is_dev()
            && send_notification_via_osascript(&resolved_title, &resolved_body).is_ok()
        {
            return Ok(());
        }
    }

    Err("Notification failed to dispatch.".to_string())
}

#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<(), String> {
    if app
        .notification()
        .builder()
        .title("Wingman Desktop")
        .body("Notifications are enabled and working.")
        .show()
        .is_ok()
    {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        if send_notification_via_nsusernotification(
            "Wingman Desktop",
            "Notifications are enabled and working.",
        )
        .is_ok()
        {
            return Ok(());
        }
        if tauri::is_dev()
            && send_notification_via_osascript(
                "Wingman Desktop",
                "Notifications are enabled and working.",
            )
            .is_ok()
        {
            return Ok(());
        }
    }

    Err("Notification test failed to dispatch.".to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSystemCommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub fn run_system_command(
    command: String,
    args: Vec<String>,
) -> Result<RunSystemCommandResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty.".to_string());
    }

    let output = Command::new(trimmed)
        .args(args)
        .output()
        .map_err(|err| format!("Failed to execute command: {err}"))?;

    Ok(RunSystemCommandResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
