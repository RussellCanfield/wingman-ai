#[cfg(target_os = "macos")]
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
#[cfg(target_os = "macos")]
use std::time::{SystemTime, UNIX_EPOCH};

use crate::state::{AppState, SharedState};

struct SpeechRuntime {
    child: Option<Child>,
    #[cfg(target_os = "macos")]
    pid: Option<u32>,
    #[cfg(target_os = "macos")]
    session_dir: Option<std::path::PathBuf>,
}

fn runtime_slot() -> &'static Mutex<Option<SpeechRuntime>> {
    static SLOT: OnceLock<Mutex<Option<SpeechRuntime>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

fn with_state<F>(shared: &Arc<Mutex<AppState>>, f: F)
where
    F: FnOnce(&mut AppState),
{
    if let Ok(mut guard) = shared.lock() {
        f(&mut guard);
    }
}

fn parse_speech_line(line: &str, shared: &Arc<Mutex<AppState>>) {
    if let Some(rest) = line.strip_prefix("STATUS\t") {
        with_state(shared, |state| state.speech_status = rest.to_string());
        return;
    }
    if let Some(rest) = line.strip_prefix("PARTIAL\t") {
        with_state(shared, |state| {
            state.transcript = rest.to_string();
            state.speech_status = "Listening...".to_string();
        });
        return;
    }
    if let Some(rest) = line.strip_prefix("FINAL\t") {
        with_state(shared, |state| {
            state.transcript = rest.to_string();
            state.speech_status = "Listening...".to_string();
        });
        return;
    }
    if let Some(rest) = line.strip_prefix("ERROR\t") {
        with_state(shared, |state| {
            state.speech_status = format!("Native speech error: {rest}");
        });
        return;
    }

    let trimmed = line.trim();
    if !trimmed.is_empty() {
        with_state(shared, |state| {
            state.speech_status = format!("Native speech bridge: {trimmed}");
        });
    }
}

#[cfg(target_os = "macos")]
fn create_session_dir() -> Result<std::path::PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("failed to read system time: {err}"))?
        .as_millis();
    let dir = std::env::temp_dir().join(format!("wingman-speech-bridge-{timestamp}"));
    fs::create_dir_all(&dir)
        .map_err(|err| format!("failed to create speech bridge session dir: {err}"))?;
    Ok(dir)
}

#[cfg(target_os = "macos")]
fn mkfifo(path: &std::path::Path) -> Result<(), String> {
    let status = Command::new("mkfifo")
        .arg(path)
        .status()
        .map_err(|err| format!("failed to invoke mkfifo: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("mkfifo failed with status {status}"))
    }
}

#[cfg(target_os = "macos")]
fn spawn_fifo_reader(path: std::path::PathBuf, shared: Arc<Mutex<AppState>>) {
    thread::spawn(move || {
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(err) => {
                with_state(&shared, |state| {
                    state.speech_status = format!(
                        "Native speech bridge reader failed to open {}: {err}",
                        path.display()
                    );
                });
                return;
            }
        };
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            parse_speech_line(line.trim(), &shared);
        }
    });
}

#[cfg(target_os = "macos")]
fn wait_for_pid_file(pid_file: &std::path::Path) -> Result<u32, String> {
    for _ in 0..40 {
        if let Ok(raw) = fs::read_to_string(pid_file) {
            if let Ok(pid) = raw.trim().parse::<u32>() {
                return Ok(pid);
            }
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err(format!(
        "speech bridge did not report a pid file at {}",
        pid_file.display()
    ))
}

#[cfg(target_os = "macos")]
fn process_is_alive(pid: u32) -> bool {
    Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn terminate_process(pid: u32) {
    let _ = Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .status();
    for _ in 0..20 {
        if !process_is_alive(pid) {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    let _ = Command::new("kill")
        .arg("-KILL")
        .arg(pid.to_string())
        .status();
}

#[cfg(target_os = "macos")]
fn helper_processes_alive() -> bool {
    Command::new("pgrep")
        .arg("-f")
        .arg("wingman_speech_bridge")
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn terminate_helper_processes() {
    let _ = Command::new("pkill")
        .arg("-f")
        .arg("wingman_speech_bridge")
        .status();
    for _ in 0..20 {
        if !helper_processes_alive() {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    let _ = Command::new("pkill")
        .arg("-9")
        .arg("-f")
        .arg("wingman_speech_bridge")
        .status();
}

#[cfg(target_os = "macos")]
pub fn start_capture(shared: &SharedState) -> Result<(), String> {
    stop_capture(shared);

    with_state(&shared.0, |state| {
        state.speech_status = "Starting native speech...".to_string()
    });

    let session_dir = create_session_dir()?;
    let stdout_pipe = session_dir.join("stdout.pipe");
    let stderr_pipe = session_dir.join("stderr.pipe");
    let pid_file = session_dir.join("pid.txt");
    mkfifo(&stdout_pipe)?;
    mkfifo(&stderr_pipe)?;
    spawn_fifo_reader(stdout_pipe.clone(), shared.0.clone());
    spawn_fifo_reader(stderr_pipe.clone(), shared.0.clone());

    let helper_app = env!("WINGMAN_SPEECH_BRIDGE_APP");
    let child = Command::new("open")
        .arg("-n")
        .arg("-g")
        .arg("-j")
        .arg("-o")
        .arg(&stdout_pipe)
        .arg("--stderr")
        .arg(&stderr_pipe)
        .arg(helper_app)
        .arg("--args")
        .arg("--pid-file")
        .arg(&pid_file)
        .spawn()
        .map_err(|err| {
            let _ = fs::remove_dir_all(&session_dir);
            format!("Failed to launch macOS speech bridge app: {err}")
        })?;

    let pid = wait_for_pid_file(&pid_file).map_err(|err| {
        let _ = fs::remove_dir_all(&session_dir);
        err
    })?;
    thread::sleep(Duration::from_millis(250));
    if !process_is_alive(pid) {
        let _ = fs::remove_dir_all(&session_dir);
        with_state(&shared.0, |state| {
            state.speech_status = "Native speech bridge exited early. Check Speech Recognition and Microphone permissions.".to_string();
        });
        return Err("speech bridge exited early".to_string());
    }

    let slot = runtime_slot();
    let mut runtime = slot
        .lock()
        .map_err(|_| "speech runtime lock poisoned".to_string())?;
    *runtime = Some(SpeechRuntime {
        child: Some(child),
        pid: Some(pid),
        session_dir: Some(session_dir),
    });
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn start_capture(_shared: &SharedState) -> Result<(), String> {
    Err("Native speech capture is only implemented for macOS.".to_string())
}

pub fn stop_capture(shared: &SharedState) {
    let slot = runtime_slot();
    if let Ok(mut runtime) = slot.lock() {
        if let Some(mut running) = runtime.take() {
            #[cfg(target_os = "macos")]
            if let Some(pid) = running.pid.take() {
                terminate_process(pid);
            }

            if let Some(mut child) = running.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }

            #[cfg(target_os = "macos")]
            if let Some(session_dir) = running.session_dir.take() {
                let _ = fs::remove_dir_all(session_dir);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Safety net in case runtime state was lost but helper is still alive.
        terminate_helper_processes();
    }

    with_state(&shared.0, |state| {
        state.speech_status = "Native speech idle.".to_string();
    });
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::parse_speech_line;
    use crate::state::AppState;

    #[test]
    fn parser_updates_transcript_on_partial_lines() {
        let shared = Arc::new(Mutex::new(AppState::default()));
        parse_speech_line("PARTIAL\thello world", &shared);
        let guard = shared.lock().expect("lock should not be poisoned");
        assert_eq!(guard.transcript, "hello world");
        assert_eq!(guard.speech_status, "Listening...");
    }

    #[test]
    fn parser_surfaces_unstructured_lines() {
        let shared = Arc::new(Mutex::new(AppState::default()));
        parse_speech_line("swift runtime warning", &shared);
        let guard = shared.lock().expect("lock should not be poisoned");
        assert_eq!(
            guard.speech_status,
            "Native speech bridge: swift runtime warning"
        );
    }
}
