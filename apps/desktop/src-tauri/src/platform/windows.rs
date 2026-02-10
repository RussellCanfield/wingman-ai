use std::process::Command;

use super::{PermissionEntry, PermissionSnapshot, PermissionStatus, PlatformProfile};

fn map_consent_store_status(raw: &str) -> PermissionStatus {
    match raw.trim().to_ascii_lowercase().as_str() {
        "allow" | "allowforcurrentdevice" => PermissionStatus::Granted,
        "deny" => PermissionStatus::Denied,
        // Windows can set these values before explicit per-app consent is resolved.
        "systemmanaged" | "prompt" | "ask" | "notset" | "unset" => PermissionStatus::NotDetermined,
        _ => PermissionStatus::NotDetermined,
    }
}

fn parse_toast_enabled(raw: &str) -> Option<bool> {
    match raw.trim() {
        "1" => Some(true),
        "0" => Some(false),
        _ => None,
    }
}

fn run_powershell(script: &str) -> Option<String> {
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-Command")
        .arg(script)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        None
    } else {
        Some(stdout)
    }
}

fn read_consent_store_value(capability: &str) -> Option<String> {
    let script = format!(
        "$path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{capability}'; \
if (Test-Path $path) {{ (Get-ItemProperty -Path $path -Name Value -ErrorAction SilentlyContinue).Value }}"
    );
    run_powershell(&script)
}

fn microphone_status() -> PermissionStatus {
    read_consent_store_value("microphone")
        .map(|value| map_consent_store_status(&value))
        .unwrap_or(PermissionStatus::NotDetermined)
}

fn speech_status() -> PermissionStatus {
    // Windows variants differ between releases; probe both keys.
    let raw = read_consent_store_value("speech")
        .or_else(|| read_consent_store_value("speechRecognition"));
    raw.map(|value| map_consent_store_status(&value))
        .unwrap_or(PermissionStatus::NotDetermined)
}

fn notifications_status() -> PermissionStatus {
    let raw = run_powershell(
        "$path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications'; \
if (Test-Path $path) {{ (Get-ItemProperty -Path $path -Name ToastEnabled -ErrorAction SilentlyContinue).ToastEnabled }}",
    );
    match raw.as_deref().and_then(parse_toast_enabled) {
        Some(true) => PermissionStatus::Granted,
        Some(false) => PermissionStatus::Denied,
        None => PermissionStatus::NotDetermined,
    }
}

fn open_settings_uri(uri: &str) -> Result<(), String> {
    let command = format!("Start-Process '{uri}'");
    let status = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-Command")
        .arg(command)
        .status()
        .map_err(|err| format!("Failed to open Windows Settings URI: {err}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Windows Settings launch command failed with status: {status}"
        ))
    }
}

pub fn profile() -> PlatformProfile {
    PlatformProfile {
        os: "windows".to_string(),
        supports_tray: true,
        supports_overlay: true,
        supports_global_hotkeys: true,
        supports_deep_links: false,
        supports_notifications: true,
        default_record_hotkey: "caps_lock".to_string(),
        default_overlay_hotkey: "double_shift".to_string(),
        hotkey_options: vec![
            "caps_lock".to_string(),
            "double_shift".to_string(),
            "double_control".to_string(),
            "double_alt".to_string(),
            "double_windows".to_string(),
        ],
    }
}

pub fn permission_snapshot() -> PermissionSnapshot {
    let microphone = microphone_status();
    let speech = speech_status();
    let notifications = notifications_status();

    PermissionSnapshot {
        items: vec![
            PermissionEntry {
                id: "microphone".to_string(),
                label: "Microphone".to_string(),
                status: microphone,
                can_open_settings: true,
            },
            PermissionEntry {
                id: "speech".to_string(),
                label: "Speech Recognition".to_string(),
                status: speech,
                can_open_settings: true,
            },
            PermissionEntry {
                id: "notifications".to_string(),
                label: "Notifications".to_string(),
                status: notifications,
                can_open_settings: true,
            },
        ],
        note: "Windows adapter active. Privacy probes use registry-backed consent state for Microphone, Speech Recognition, and Notifications.".to_string(),
    }
}

pub fn open_permission_settings(permission_id: &str) -> Result<(), String> {
    let target = match permission_id {
        "microphone" => "ms-settings:privacy-microphone",
        "speech" => "ms-settings:privacy-speech",
        "notifications" => "ms-settings:notifications",
        _ => return Err(format!("Unknown permission id: {permission_id}")),
    };
    open_settings_uri(target)
}

#[cfg(test)]
mod tests {
    use super::{map_consent_store_status, parse_toast_enabled, PermissionStatus};

    #[test]
    fn maps_windows_consent_status_values() {
        assert!(matches!(
            map_consent_store_status("Allow"),
            PermissionStatus::Granted
        ));
        assert!(matches!(
            map_consent_store_status("Deny"),
            PermissionStatus::Denied
        ));
        assert!(matches!(
            map_consent_store_status("Prompt"),
            PermissionStatus::NotDetermined
        ));
    }

    #[test]
    fn parses_toast_toggle_values() {
        assert_eq!(parse_toast_enabled("1"), Some(true));
        assert_eq!(parse_toast_enabled("0"), Some(false));
        assert_eq!(parse_toast_enabled("unknown"), None);
    }
}
