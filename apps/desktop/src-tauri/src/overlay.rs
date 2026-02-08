use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

const OVERLAY_LABEL: &str = "overlay";
const OVERLAY_ROUTE: &str = "overlay.html";

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSScreenSaverWindowLevel, NSWindow, NSWindowCollectionBehavior};

fn overlay_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.get_webview_window(OVERLAY_LABEL)
}

fn overlay_window_url() -> WebviewUrl {
    WebviewUrl::App(OVERLAY_ROUTE.into())
}

fn create_overlay_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    let window = WebviewWindowBuilder::new(app, OVERLAY_LABEL, overlay_window_url())
        .title("Wingman Overlay")
        .visible(false)
        .focused(false)
        .focusable(true)
        .accept_first_mouse(true)
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .shadow(false)
        .transparent(true)
        .build()?;

    configure_overlay_window(&window);
    Ok(window)
}

fn ensure_overlay_window_instance<R: Runtime>(
    app: &AppHandle<R>,
) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = overlay_window(app) {
        return Ok(window);
    }
    create_overlay_window(app)
}

fn fit_overlay_to_monitor<R: Runtime>(window: &WebviewWindow<R>) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let position = monitor.position();
        let size = monitor.size();
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(
            position.x, position.y,
        )));
        let _ = window.set_size(Size::Physical(PhysicalSize::new(size.width, size.height)));
    }
}

fn configure_overlay_window<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.set_decorations(false);
    let _ = window.set_shadow(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_visible_on_all_workspaces(true);
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_focusable(true);

    #[cfg(target_os = "macos")]
    configure_macos_overlay_window(window);
}

#[cfg(target_os = "macos")]
fn macos_overlay_collection_behavior() -> NSWindowCollectionBehavior {
    NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary
        | NSWindowCollectionBehavior::Stationary
        | NSWindowCollectionBehavior::IgnoresCycle
}

#[cfg(target_os = "macos")]
fn configure_macos_overlay_window<R: Runtime>(window: &WebviewWindow<R>) {
    let behavior = macos_overlay_collection_behavior();
    let result = window.with_webview(move |webview| unsafe {
        let ns_window: &NSWindow = &*webview.ns_window().cast();
        let clear = NSColor::clearColor();
        ns_window.setOpaque(false);
        ns_window.setBackgroundColor(Some(&clear));
        ns_window.setHasShadow(false);
        ns_window.setLevel(NSScreenSaverWindowLevel);
        ns_window.setCollectionBehavior(behavior);
        ns_window.setIgnoresMouseEvents(false);
        ns_window.setMovable(false);
        ns_window.setMovableByWindowBackground(false);
        ns_window.setAcceptsMouseMovedEvents(true);
        ns_window.setHidesOnDeactivate(false);
    });

    if let Err(error) = result {
        eprintln!("failed to apply native macOS overlay adapter: {error}");
    }
}

#[cfg(target_os = "macos")]
fn bring_overlay_to_front<R: Runtime>(window: &WebviewWindow<R>) {
    let result = window.with_webview(|webview| unsafe {
        let ns_window: &NSWindow = &*webview.ns_window().cast();
        ns_window.orderFrontRegardless();
    });

    if let Err(error) = result {
        eprintln!("failed to order overlay in front: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn bring_overlay_to_front<R: Runtime>(_window: &WebviewWindow<R>) {}

fn show_overlay_window<R: Runtime>(window: &WebviewWindow<R>) {
    fit_overlay_to_monitor(window);
    configure_overlay_window(window);
    let _ = window.show();

    #[cfg(target_os = "macos")]
    {
        bring_overlay_to_front(window);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_fullscreen(true);
    }

    let _ = window.set_focus();
}

fn hide_overlay_window_internal<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_fullscreen(false);
    }
    let _ = window.hide();
}

pub fn sync_overlay_window<R: Runtime>(app: &AppHandle<R>, visible: bool) {
    if visible {
        match ensure_overlay_window_instance(app) {
            Ok(window) => show_overlay_window(&window),
            Err(error) => eprintln!("failed to create overlay window: {error}"),
        }
        return;
    }

    if let Some(window) = overlay_window(app) {
        hide_overlay_window_internal(&window);
    }
}

pub fn hide_overlay_window<R: Runtime>(app: &AppHandle<R>) {
    sync_overlay_window(app, false);
}

#[cfg(test)]
mod tests {
    use super::OVERLAY_ROUTE;

    #[test]
    fn overlay_route_targets_overlay_page() {
        assert_eq!(OVERLAY_ROUTE, "overlay.html");
    }
}

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    use super::macos_overlay_collection_behavior;
    use objc2_app_kit::NSWindowCollectionBehavior;

    #[test]
    fn macos_overlay_behavior_includes_spaces_and_fullscreen_auxiliary() {
        let behavior = macos_overlay_collection_behavior();
        assert!(behavior.contains(NSWindowCollectionBehavior::CanJoinAllSpaces));
        assert!(behavior.contains(NSWindowCollectionBehavior::FullScreenAuxiliary));
        assert!(behavior.contains(NSWindowCollectionBehavior::Stationary));
    }
}
