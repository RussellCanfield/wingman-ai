#[cfg(target_os = "macos")]
use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
#[cfg(target_os = "macos")]
use std::collections::HashSet;
#[cfg(target_os = "macos")]
use std::env;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacosInboundMessage {
    pub row_id: i64,
    pub handle: String,
    pub text: String,
}

#[cfg(target_os = "macos")]
fn messages_db_path() -> Result<PathBuf, String> {
    let home = env::var("HOME").map_err(|_| "HOME environment variable is not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Messages")
        .join("chat.db"))
}

#[cfg(target_os = "macos")]
fn open_messages_db() -> Result<Connection, String> {
    let path = messages_db_path()?;
    let uri = format!("file:{}?mode=ro&immutable=1", path.to_string_lossy());
    let uri_flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI;
    if let Ok(connection) = Connection::open_with_flags(&uri, uri_flags) {
        return Ok(connection);
    }
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|err| format!("Failed to open Messages database: {err}"))
}

fn normalize_inbound_message(
    row_id: i64,
    handle: String,
    text: String,
) -> Option<MacosInboundMessage> {
    if row_id <= 0 {
        return None;
    }
    let handle = handle.trim().to_string();
    let text = text.trim().to_string();
    if handle.is_empty() || text.is_empty() {
        return None;
    }
    Some(MacosInboundMessage {
        row_id,
        handle,
        text,
    })
}

fn normalize_optional_inbound_message(
    row_id: i64,
    handle: Option<String>,
    text: Option<String>,
) -> Option<MacosInboundMessage> {
    normalize_inbound_message(row_id, handle.unwrap_or_default(), text.unwrap_or_default())
}

#[tauri::command]
pub fn get_macos_messages_latest_row_id() -> Result<i64, String> {
    #[cfg(target_os = "macos")]
    {
        let connection = open_messages_db()?;
        let row_id = connection
            .query_row("SELECT IFNULL(MAX(ROWID), 0) FROM message;", [], |row| {
                row.get::<usize, i64>(0)
            })
            .map_err(|err| format!("Failed to query latest message row: {err}"))?;
        return Ok(row_id.max(0));
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS Messages bridge is only available on macOS".to_string())
    }
}

#[tauri::command]
pub fn poll_macos_messages(
    after_row_id: i64,
    limit: u32,
) -> Result<Vec<MacosInboundMessage>, String> {
    #[cfg(target_os = "macos")]
    {
        let after = after_row_id.max(0);
        let max_rows = limit.clamp(1, 200);
        let connection = open_messages_db()?;
        let mut statement = connection
            .prepare(
                "SELECT m.ROWID, \
                    COALESCE(h.id, c.chat_identifier, ''), \
                    REPLACE(REPLACE(REPLACE(IFNULL(m.text, ''), char(9), ' '), char(10), ' '), char(13), ' ') \
                 FROM message m \
                 LEFT JOIN handle h ON h.ROWID = m.handle_id \
                 LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID \
                 LEFT JOIN chat c ON c.ROWID = cmj.chat_id \
                 WHERE m.ROWID > ?1 \
                   AND m.text IS NOT NULL \
                   AND LENGTH(TRIM(m.text)) > 0 \
                 ORDER BY m.ROWID ASC \
                 LIMIT ?2;",
            )
            .map_err(|err| format!("Failed to prepare Messages query: {err}"))?;

        let rows = statement
            .query_map(params![after, max_rows], |row| {
                Ok((
                    row.get::<usize, i64>(0)?,
                    row.get::<usize, Option<String>>(1)?,
                    row.get::<usize, Option<String>>(2)?,
                ))
            })
            .map_err(|err| format!("Failed to execute Messages query: {err}"))?;

        let mut seen = HashSet::<i64>::new();
        let mut messages = Vec::<MacosInboundMessage>::new();
        for row in rows {
            let (row_id, handle, text) =
                row.map_err(|err| format!("Failed to decode Messages row: {err}"))?;
            if !seen.insert(row_id) {
                continue;
            }
            if let Some(message) = normalize_optional_inbound_message(row_id, handle, text) {
                messages.push(message);
            }
        }
        return Ok(messages);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = after_row_id;
        let _ = limit;
        Err("macOS Messages bridge is only available on macOS".to_string())
    }
}

#[tauri::command]
pub fn send_macos_message(handle: String, text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let target = handle.trim();
        let body = text.trim();
        if target.is_empty() {
            return Err("A destination handle is required".to_string());
        }
        if body.is_empty() {
            return Err("A non-empty message body is required".to_string());
        }

        let script = format!(
            "on run argv\n\
                set targetHandle to item 1 of argv\n\
                set messageBody to item 2 of argv\n\
                tell application \"Messages\"\n\
                    set targetService to missing value\n\
                    repeat with svc in services\n\
                        try\n\
                            set targetBuddy to buddy targetHandle of svc\n\
                            set targetService to svc\n\
                            exit repeat\n\
                        end try\n\
                    end repeat\n\
                    if targetService is missing value then error \"No buddy found for \" & targetHandle\n\
                    send messageBody to buddy targetHandle of targetService\n\
                end tell\n\
            end run"
        );
        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .arg(target)
            .arg(body)
            .output()
            .map_err(|err| format!("Failed to run osascript: {err}"))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        if detail.is_empty() {
            return Err(format!("osascript failed with status {}", output.status));
        }
        Err(format!("osascript failed: {detail}"))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = handle;
        let _ = text;
        Err("macOS Messages bridge is only available on macOS".to_string())
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::{normalize_inbound_message, normalize_optional_inbound_message};

    #[test]
    fn normalize_inbound_message_filters_invalid_rows() {
        assert!(
            normalize_inbound_message(0, "+15555550000".to_string(), "hello".to_string()).is_none()
        );
        assert!(normalize_inbound_message(42, "".to_string(), "hello".to_string()).is_none());
        assert!(
            normalize_inbound_message(42, "+15555550000".to_string(), "".to_string()).is_none()
        );

        let parsed = normalize_inbound_message(
            123,
            " +15555550000 ".to_string(),
            " hello there ".to_string(),
        )
        .expect("expected valid row");
        assert_eq!(parsed.row_id, 123);
        assert_eq!(parsed.handle, "+15555550000");
        assert_eq!(parsed.text, "hello there");
    }

    #[test]
    fn normalize_optional_inbound_message_handles_null_columns() {
        assert!(
            normalize_optional_inbound_message(42, None, Some("hello".to_string())).is_none()
        );
        assert!(
            normalize_optional_inbound_message(42, Some("+15555550000".to_string()), None)
                .is_none()
        );

        let parsed = normalize_optional_inbound_message(
            42,
            Some("+15555550000".to_string()),
            Some("hello".to_string()),
        )
        .expect("expected valid optional row");
        assert_eq!(parsed.row_id, 42);
        assert_eq!(parsed.handle, "+15555550000");
        assert_eq!(parsed.text, "hello");
    }
}
