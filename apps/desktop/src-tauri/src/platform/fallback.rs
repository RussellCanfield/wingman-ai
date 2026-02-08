use super::{PermissionEntry, PermissionSnapshot, PermissionStatus, PlatformProfile};

pub fn profile() -> PlatformProfile {
    PlatformProfile {
        os: std::env::consts::OS.to_string(),
        supports_tray: false,
        supports_overlay: false,
        supports_global_hotkeys: false,
        supports_deep_links: false,
        supports_notifications: false,
        default_record_hotkey: "caps_lock".to_string(),
        default_overlay_hotkey: "double_shift".to_string(),
        hotkey_options: vec!["caps_lock".to_string(), "double_shift".to_string()],
    }
}

pub fn permission_snapshot() -> PermissionSnapshot {
    PermissionSnapshot {
        items: vec![PermissionEntry {
            id: "microphone".to_string(),
            label: "Microphone".to_string(),
            status: PermissionStatus::Unsupported,
            can_open_settings: false,
        }],
        note: "No native adapter exists for this OS.".to_string(),
    }
}

pub fn open_permission_settings(_permission_id: &str) -> Result<(), String> {
    Err("No native adapter exists for this OS.".to_string())
}
