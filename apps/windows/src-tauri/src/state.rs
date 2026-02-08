use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewaySettings {
    pub url: String,
    pub ui_url: String,
    pub token: String,
    pub password: String,
    pub agent_id: String,
    pub session_key: String,
}

impl Default for GatewaySettings {
    fn default() -> Self {
        Self {
            url: "ws://127.0.0.1:18789/ws".to_string(),
            ui_url: String::new(),
            token: String::new(),
            password: String::new(),
            agent_id: String::new(),
            session_key: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub connected: bool,
    pub recording: bool,
    pub overlay_visible: bool,
    pub transcript: String,
    pub speech_status: String,
    pub record_hotkey: String,
    pub overlay_hotkey: String,
    pub quick_send_on_record_hotkey: bool,
    pub quick_send_nonce: u64,
    pub recording_started_by_hotkey: bool,
    pub gateway: GatewaySettings,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connected: false,
            recording: false,
            overlay_visible: false,
            transcript: String::new(),
            speech_status: "Native speech idle.".to_string(),
            record_hotkey: "CommandOrControl+Shift+R".to_string(),
            overlay_hotkey: "CommandOrControl+Shift+O".to_string(),
            quick_send_on_record_hotkey: true,
            quick_send_nonce: 0,
            recording_started_by_hotkey: false,
            gateway: GatewaySettings::default(),
        }
    }
}

#[derive(Clone, Default)]
pub struct SharedState(pub Arc<Mutex<AppState>>);
