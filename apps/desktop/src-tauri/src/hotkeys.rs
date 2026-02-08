use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::app_logic::{self, RecordingSource};
use crate::state::{AppState, SharedState};

#[derive(Default)]
struct RegisteredHotkeys {
    record: Option<Shortcut>,
    overlay: Option<Shortcut>,
}

fn registered_slot() -> &'static Mutex<RegisteredHotkeys> {
    static SLOT: OnceLock<Mutex<RegisteredHotkeys>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(RegisteredHotkeys::default()))
}

fn parse_shortcut(value: &str, label: &str) -> Result<Shortcut, String> {
    value
        .parse::<Shortcut>()
        .map_err(|error| format!("Invalid {label} hotkey `{value}`: {error}"))
}

fn unregister_existing<R: Runtime>(app: &AppHandle<R>, registered: &mut RegisteredHotkeys) {
    let manager = app.global_shortcut();
    if let Some(shortcut) = registered.record.take() {
        let _ = manager.unregister(shortcut);
    }
    if let Some(shortcut) = registered.overlay.take() {
        let _ = manager.unregister(shortcut);
    }
}

fn register_hotkeys<R: Runtime>(
    app: &AppHandle<R>,
    record_hotkey: &str,
    overlay_hotkey: &str,
) -> Result<(), String> {
    let record = parse_shortcut(record_hotkey, "record")?;
    let overlay = parse_shortcut(overlay_hotkey, "overlay")?;

    let slot = registered_slot();
    let mut registered = slot
        .lock()
        .map_err(|_| "hotkey registry lock poisoned".to_string())?;
    unregister_existing(app, &mut registered);

    let manager = app.global_shortcut();
    manager
        .register(record.clone())
        .map_err(|error| format!("Failed to register record hotkey: {error}"))?;
    manager
        .register(overlay.clone())
        .map_err(|error| format!("Failed to register overlay hotkey: {error}"))?;

    registered.record = Some(record);
    registered.overlay = Some(overlay);
    Ok(())
}

pub fn initialize_hotkeys<R: Runtime>(
    app: &AppHandle<R>,
    state: &SharedState,
) -> Result<(), String> {
    let snapshot = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?
        .clone();
    register_hotkeys(app, &snapshot.record_hotkey, &snapshot.overlay_hotkey)
}

pub fn apply_hotkey_settings<R: Runtime>(
    app: &AppHandle<R>,
    state: &SharedState,
    record_hotkey: String,
    overlay_hotkey: String,
    quick_send_on_record_hotkey: bool,
) -> Result<AppState, String> {
    let record_trimmed = record_hotkey.trim().to_string();
    let overlay_trimmed = overlay_hotkey.trim().to_string();
    if record_trimmed.is_empty() || overlay_trimmed.is_empty() {
        return Err("Hotkeys cannot be empty.".to_string());
    }

    register_hotkeys(app, &record_trimmed, &overlay_trimmed)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    guard.record_hotkey = record_trimmed;
    guard.overlay_hotkey = overlay_trimmed;
    guard.quick_send_on_record_hotkey = quick_send_on_record_hotkey;
    Ok(guard.clone())
}

fn emit_state_changed<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("wingman://state-changed", ());
}

pub fn on_shortcut<R: Runtime>(app: &AppHandle<R>, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }
    let (is_record, is_overlay) = {
        let slot = registered_slot();
        let registered = match slot.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        (
            registered
                .record
                .as_ref()
                .map(|value| value == shortcut)
                .unwrap_or(false),
            registered
                .overlay
                .as_ref()
                .map(|value| value == shortcut)
                .unwrap_or(false),
        )
    };
    let shared = app.state::<SharedState>();
    if is_record {
        let _ = app_logic::toggle_recording_with_source(app, &shared, RecordingSource::Hotkey);
        emit_state_changed(app);
        return;
    }
    if is_overlay {
        let _ = app_logic::toggle_overlay(app, &shared);
        emit_state_changed(app);
    }
}

#[cfg(test)]
mod tests {
    use super::parse_shortcut;

    #[test]
    fn rejects_invalid_hotkey() {
        let result = parse_shortcut("not-a-shortcut", "record");
        assert!(result.is_err());
    }

    #[test]
    fn accepts_tauri_accelerator_format() {
        let result = parse_shortcut("CommandOrControl+Shift+R", "record");
        assert!(result.is_ok());
    }
}
