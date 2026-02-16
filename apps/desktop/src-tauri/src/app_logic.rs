use tauri::{AppHandle, Runtime};

use crate::overlay;
use crate::speech;
use crate::state::{AppState, SharedState};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecordingSource {
    Ui,
    Hotkey,
}

fn overlay_visible_after_stop(source: RecordingSource) -> bool {
    source == RecordingSource::Ui
}

fn should_queue_quick_send(
    source: RecordingSource,
    quick_send_on_record_hotkey: bool,
    transcript: &str,
) -> bool {
    source == RecordingSource::Hotkey
        && quick_send_on_record_hotkey
        && !transcript.trim().is_empty()
}

fn snapshot(shared: &SharedState) -> Result<AppState, String> {
    let guard = shared
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    Ok(guard.clone())
}

fn reset_recording_state_for_shutdown(shared: &SharedState) {
    if let Ok(mut guard) = shared.0.lock() {
        guard.recording = false;
        guard.overlay_visible = false;
        guard.recording_started_by_hotkey = false;
    }
}

pub fn stop_recording_for_shutdown(shared: &SharedState) {
    reset_recording_state_for_shutdown(shared);
    speech::stop_capture(shared);
}

pub fn toggle_recording<R: Runtime>(
    app: &AppHandle<R>,
    shared: &SharedState,
) -> Result<AppState, String> {
    toggle_recording_with_source(app, shared, RecordingSource::Ui)
}

pub fn toggle_recording_with_source<R: Runtime>(
    app: &AppHandle<R>,
    shared: &SharedState,
    source: RecordingSource,
) -> Result<AppState, String> {
    let start_recording = {
        let mut guard = shared
            .0
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        guard.recording = !guard.recording;
        if guard.recording {
            guard.overlay_visible = true;
            guard.transcript.clear();
            guard.recording_started_by_hotkey = source == RecordingSource::Hotkey;
        } else {
            guard.overlay_visible = overlay_visible_after_stop(source);
        }
        guard.recording
    };

    if start_recording {
        if let Err(error) = speech::start_capture(shared) {
            let mut guard = shared
                .0
                .lock()
                .map_err(|_| "state lock poisoned".to_string())?;
            guard.recording = false;
            guard.overlay_visible = false;
            guard.speech_status = format!("Speech start failed: {error}");
            guard.recording_started_by_hotkey = false;
        }
    } else {
        speech::stop_capture(shared);
        let mut guard = shared
            .0
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        let should_queue =
            should_queue_quick_send(source, guard.quick_send_on_record_hotkey, &guard.transcript);
        guard.recording_started_by_hotkey = false;
        if should_queue {
            guard.quick_send_nonce = guard.quick_send_nonce.saturating_add(1);
        }
    }

    let next = snapshot(shared)?;
    overlay::sync_overlay_window(app, next.overlay_visible);
    Ok(next)
}

pub fn toggle_overlay<R: Runtime>(
    app: &AppHandle<R>,
    shared: &SharedState,
) -> Result<AppState, String> {
    let hide_and_stop = {
        let mut guard = shared
            .0
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        guard.overlay_visible = !guard.overlay_visible;
        if !guard.overlay_visible {
            guard.recording = false;
            guard.recording_started_by_hotkey = false;
        }
        !guard.overlay_visible
    };

    if hide_and_stop {
        speech::stop_capture(shared);
    }

    let next = snapshot(shared)?;
    overlay::sync_overlay_window(app, next.overlay_visible);
    Ok(next)
}

pub fn hide_overlay<R: Runtime>(
    app: &AppHandle<R>,
    shared: &SharedState,
) -> Result<AppState, String> {
    {
        let mut guard = shared
            .0
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        guard.overlay_visible = false;
        guard.recording = false;
        guard.recording_started_by_hotkey = false;
    }

    speech::stop_capture(shared);
    overlay::hide_overlay_window(app);
    snapshot(shared)
}

pub fn clear_quick_send_nonce(shared: &SharedState) -> Result<AppState, String> {
    let mut guard = shared
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    guard.quick_send_nonce = 0;
    Ok(guard.clone())
}

pub fn queue_quick_send(shared: &SharedState) -> Result<AppState, String> {
    let mut guard = shared
        .0
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    if !guard.transcript.trim().is_empty() {
        guard.quick_send_nonce = guard.quick_send_nonce.saturating_add(1);
    }
    Ok(guard.clone())
}

#[cfg(test)]
mod tests {
    use super::{
        overlay_visible_after_stop, queue_quick_send, reset_recording_state_for_shutdown,
        should_queue_quick_send, RecordingSource,
    };
    use crate::state::SharedState;

    #[test]
    fn keeps_overlay_visible_when_stopping_from_ui() {
        assert!(overlay_visible_after_stop(RecordingSource::Ui));
    }

    #[test]
    fn hides_overlay_when_stopping_from_hotkey() {
        assert!(!overlay_visible_after_stop(RecordingSource::Hotkey));
    }

    #[test]
    fn queues_quick_send_when_stop_comes_from_hotkey() {
        assert!(should_queue_quick_send(
            RecordingSource::Hotkey,
            true,
            "hello",
        ));
    }

    #[test]
    fn does_not_queue_quick_send_when_stop_comes_from_ui() {
        assert!(!should_queue_quick_send(RecordingSource::Ui, true, "hello"));
    }

    #[test]
    fn does_not_queue_quick_send_when_transcript_is_empty() {
        assert!(!should_queue_quick_send(
            RecordingSource::Hotkey,
            true,
            "   ",
        ));
    }

    #[test]
    fn does_not_queue_quick_send_when_feature_is_disabled() {
        assert!(!should_queue_quick_send(
            RecordingSource::Hotkey,
            false,
            "hello",
        ));
    }

    #[test]
    fn queue_quick_send_increments_nonce_when_transcript_exists() {
        let shared = SharedState::default();
        {
            let mut guard = shared.0.lock().expect("state lock");
            guard.transcript = "hello".to_string();
        }
        let next = queue_quick_send(&shared).expect("queue quick send");
        assert_eq!(next.quick_send_nonce, 1);
    }

    #[test]
    fn queue_quick_send_skips_empty_transcript() {
        let shared = SharedState::default();
        let next = queue_quick_send(&shared).expect("queue quick send");
        assert_eq!(next.quick_send_nonce, 0);
    }

    #[test]
    fn reset_recording_state_for_shutdown_clears_recording_flags() {
        let shared = SharedState::default();
        {
            let mut guard = shared.0.lock().expect("state lock");
            guard.recording = true;
            guard.overlay_visible = true;
            guard.recording_started_by_hotkey = true;
        }

        reset_recording_state_for_shutdown(&shared);

        let guard = shared.0.lock().expect("state lock");
        assert!(!guard.recording);
        assert!(!guard.overlay_visible);
        assert!(!guard.recording_started_by_hotkey);
    }
}
