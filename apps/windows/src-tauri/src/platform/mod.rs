use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionStatus {
    Granted,
    Denied,
    Restricted,
    NotDetermined,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionEntry {
    pub id: String,
    pub label: String,
    pub status: PermissionStatus,
    pub can_open_settings: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionSnapshot {
    pub items: Vec<PermissionEntry>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformProfile {
    pub os: String,
    pub supports_tray: bool,
    pub supports_overlay: bool,
    pub supports_global_hotkeys: bool,
    pub supports_deep_links: bool,
    pub supports_notifications: bool,
    pub default_record_hotkey: String,
    pub default_overlay_hotkey: String,
    pub hotkey_options: Vec<String>,
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod fallback;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
pub fn profile() -> PlatformProfile {
    macos::profile()
}

#[cfg(target_os = "windows")]
pub fn profile() -> PlatformProfile {
    windows::profile()
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn profile() -> PlatformProfile {
    fallback::profile()
}

#[cfg(target_os = "macos")]
pub fn permission_snapshot() -> PermissionSnapshot {
    macos::permission_snapshot()
}

#[cfg(target_os = "windows")]
pub fn permission_snapshot() -> PermissionSnapshot {
    windows::permission_snapshot()
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn permission_snapshot() -> PermissionSnapshot {
    fallback::permission_snapshot()
}

#[cfg(target_os = "macos")]
pub fn open_permission_settings(permission_id: &str) -> Result<(), String> {
    macos::open_permission_settings(permission_id)
}

#[cfg(target_os = "windows")]
pub fn open_permission_settings(permission_id: &str) -> Result<(), String> {
    windows::open_permission_settings(permission_id)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn open_permission_settings(permission_id: &str) -> Result<(), String> {
    fallback::open_permission_settings(permission_id)
}
