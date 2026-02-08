use serde::Deserialize;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use super::{PermissionEntry, PermissionSnapshot, PermissionStatus, PlatformProfile};

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn CGPreflightScreenCaptureAccess() -> bool;
}

fn granted_or_denied(granted: bool) -> PermissionStatus {
    if granted {
        PermissionStatus::Granted
    } else {
        PermissionStatus::Denied
    }
}

fn accessibility_status() -> PermissionStatus {
    // The API only reports trusted/untrusted, not denied vs not_determined.
    unsafe { granted_or_denied(AXIsProcessTrusted()) }
}

fn screen_recording_status() -> PermissionStatus {
    // Preflight reports access state without prompting.
    unsafe { granted_or_denied(CGPreflightScreenCaptureAccess()) }
}

#[derive(Debug, Deserialize)]
struct PermissionProbeOutput {
    microphone: String,
    speech: String,
    notifications: String,
}

#[derive(Clone)]
struct ProbeStatuses {
    microphone: PermissionStatus,
    speech: PermissionStatus,
    notifications: PermissionStatus,
}

#[derive(Clone)]
struct ProbeCacheEntry {
    at: Instant,
    statuses: ProbeStatuses,
}

fn probe_cache_slot() -> &'static Mutex<Option<ProbeCacheEntry>> {
    static SLOT: OnceLock<Mutex<Option<ProbeCacheEntry>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

fn map_probe_status(raw: &str) -> PermissionStatus {
    match raw.trim().to_lowercase().as_str() {
        "authorized" | "granted" | "provisional" | "ephemeral" => PermissionStatus::Granted,
        "denied" => PermissionStatus::Denied,
        "restricted" => PermissionStatus::Restricted,
        "notdetermined" | "not_determined" | "not determined" => PermissionStatus::NotDetermined,
        "unsupported" => PermissionStatus::Unsupported,
        _ => PermissionStatus::NotDetermined,
    }
}

fn run_permission_probe() -> Result<ProbeStatuses, String> {
    let helper_bin = env!("WINGMAN_SPEECH_BRIDGE_BIN");
    let output = Command::new(helper_bin)
        .arg("--probe-permissions")
        .output()
        .map_err(|err| format!("Failed to launch permission probe helper: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("Permission probe helper failed: {detail}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: PermissionProbeOutput = serde_json::from_str(stdout.trim())
        .map_err(|err| format!("Invalid permission probe payload: {err}"))?;
    Ok(ProbeStatuses {
        microphone: map_probe_status(&parsed.microphone),
        speech: map_probe_status(&parsed.speech),
        notifications: map_probe_status(&parsed.notifications),
    })
}

fn read_probe_statuses() -> Option<ProbeStatuses> {
    const TTL: Duration = Duration::from_secs(3);
    let cache = probe_cache_slot();
    if let Ok(guard) = cache.lock() {
        if let Some(entry) = guard.as_ref() {
            if entry.at.elapsed() <= TTL {
                return Some(entry.statuses.clone());
            }
        }
    }

    let probe = run_permission_probe();
    if let Ok(statuses) = probe {
        if let Ok(mut guard) = cache.lock() {
            *guard = Some(ProbeCacheEntry {
                at: Instant::now(),
                statuses: statuses.clone(),
            });
        }
        return Some(statuses);
    }

    if let Ok(guard) = cache.lock() {
        return guard.as_ref().map(|entry| entry.statuses.clone());
    }
    None
}

pub fn profile() -> PlatformProfile {
    PlatformProfile {
        os: "macos".to_string(),
        supports_tray: true,
        supports_overlay: true,
        supports_global_hotkeys: true,
        supports_deep_links: true,
        supports_notifications: true,
        default_record_hotkey: "caps_lock".to_string(),
        default_overlay_hotkey: "double_shift".to_string(),
        hotkey_options: vec![
            "caps_lock".to_string(),
            "double_shift".to_string(),
            "double_control".to_string(),
            "double_option".to_string(),
            "double_command".to_string(),
        ],
    }
}

pub fn permission_snapshot() -> PermissionSnapshot {
    let probe = read_probe_statuses();
    let microphone_status = probe
        .as_ref()
        .map(|entry| entry.microphone.clone())
        .unwrap_or(PermissionStatus::NotDetermined);
    let speech_status = probe
        .as_ref()
        .map(|entry| entry.speech.clone())
        .unwrap_or(PermissionStatus::NotDetermined);
    let notifications_status = probe
        .as_ref()
        .map(|entry| entry.notifications.clone())
        .unwrap_or(PermissionStatus::NotDetermined);
    let note = if probe.is_some() {
        "macOS adapter active. Live native probes are enabled for Microphone, Speech Recognition, Accessibility, Screen Recording, and Notifications.".to_string()
    } else {
        "macOS adapter active. Accessibility and Screen Recording are live probes. Microphone, Speech Recognition, and Notifications probe helper is unavailable.".to_string()
    };

    PermissionSnapshot {
        items: vec![
            PermissionEntry {
                id: "microphone".to_string(),
                label: "Microphone".to_string(),
                status: microphone_status,
                can_open_settings: true,
            },
            PermissionEntry {
                id: "speech".to_string(),
                label: "Speech Recognition".to_string(),
                status: speech_status,
                can_open_settings: true,
            },
            PermissionEntry {
                id: "accessibility".to_string(),
                label: "Accessibility".to_string(),
                status: accessibility_status(),
                can_open_settings: true,
            },
            PermissionEntry {
                id: "screen_recording".to_string(),
                label: "Screen Recording".to_string(),
                status: screen_recording_status(),
                can_open_settings: true,
            },
            PermissionEntry {
                id: "automation".to_string(),
                label: "Automation".to_string(),
                status: PermissionStatus::NotDetermined,
                can_open_settings: true,
            },
            PermissionEntry {
                id: "notifications".to_string(),
                label: "Notifications".to_string(),
                status: notifications_status,
                can_open_settings: true,
            },
        ],
        note,
    }
}

pub fn open_permission_settings(permission_id: &str) -> Result<(), String> {
    let target = match permission_id {
        "microphone" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        "speech" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
        }
        "accessibility" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        }
        "screen_recording" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        }
        "automation" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        }
        "notifications" => "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
        _ => return Err(format!("Unknown permission id: {permission_id}")),
    };

    let status = Command::new("open")
        .arg(target)
        .status()
        .map_err(|err| format!("Failed to launch System Settings: {err}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "System Settings open command failed with status: {status}"
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{granted_or_denied, map_probe_status, PermissionStatus};

    #[test]
    fn maps_bool_to_permission_status() {
        assert!(matches!(granted_or_denied(true), PermissionStatus::Granted));
        assert!(matches!(granted_or_denied(false), PermissionStatus::Denied));
    }

    #[test]
    fn maps_probe_status_strings() {
        assert!(matches!(
            map_probe_status("authorized"),
            PermissionStatus::Granted
        ));
        assert!(matches!(
            map_probe_status("provisional"),
            PermissionStatus::Granted
        ));
        assert!(matches!(
            map_probe_status("denied"),
            PermissionStatus::Denied
        ));
        assert!(matches!(
            map_probe_status("restricted"),
            PermissionStatus::Restricted
        ));
        assert!(matches!(
            map_probe_status("notDetermined"),
            PermissionStatus::NotDetermined
        ));
    }
}
