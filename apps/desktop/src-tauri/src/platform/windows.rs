use super::{PermissionEntry, PermissionSnapshot, PermissionStatus, PlatformProfile};

pub fn profile() -> PlatformProfile {
    PlatformProfile {
        os: "windows".to_string(),
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
            "double_alt".to_string(),
            "double_windows".to_string(),
        ],
    }
}

pub fn permission_snapshot() -> PermissionSnapshot {
    PermissionSnapshot {
		items: vec![
			PermissionEntry {
				id: "microphone".to_string(),
				label: "Microphone".to_string(),
				status: PermissionStatus::Unsupported,
				can_open_settings: false,
			},
			PermissionEntry {
				id: "speech".to_string(),
				label: "Speech Recognition".to_string(),
				status: PermissionStatus::Unsupported,
				can_open_settings: false,
			},
		],
		note: "Windows adapter is reserved for the next phase; native privacy probes are not implemented yet.".to_string(),
	}
}

pub fn open_permission_settings(_permission_id: &str) -> Result<(), String> {
    Err("Permission settings links are not implemented for Windows yet.".to_string())
}
