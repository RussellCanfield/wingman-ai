use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "macos")]
fn embed_macos_info_plist_for_dev_binary() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let info_plist = manifest_dir.join("Info.plist");

    println!("cargo:rerun-if-changed={}", info_plist.display());
    println!(
        "cargo:rustc-link-arg=-Wl,-sectcreate,__TEXT,__info_plist,{}",
        info_plist.display()
    );
}

#[cfg(not(target_os = "macos"))]
fn embed_macos_info_plist_for_dev_binary() {}

#[cfg(target_os = "macos")]
fn compile_macos_speech_bridge() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("missing OUT_DIR"));
    let swift_source = manifest_dir.join("native/macos/SpeechBridge.swift");
    let helper_plist = manifest_dir.join("native/macos/SpeechBridgeHelper.plist");
    let helper_app = out_dir.join("WingmanSpeechBridge.app");
    let helper_contents = helper_app.join("Contents");
    let helper_macos_dir = helper_contents.join("MacOS");
    let helper_info_plist = helper_contents.join("Info.plist");
    let helper_bin = helper_macos_dir.join("wingman_speech_bridge");

    println!("cargo:rerun-if-changed={}", swift_source.display());
    println!("cargo:rerun-if-changed={}", helper_plist.display());

    if helper_app.exists() {
        fs::remove_dir_all(&helper_app)
            .expect("failed to remove existing speech bridge app bundle");
    }
    fs::create_dir_all(&helper_macos_dir)
        .expect("failed to create speech bridge app bundle directories");
    fs::copy(&helper_plist, &helper_info_plist).expect("failed to copy speech bridge Info.plist");

    let output = Command::new("xcrun")
        .arg("swiftc")
        .arg(&swift_source)
        .arg("-o")
        .arg(&helper_bin)
        .output()
        .expect("failed to invoke xcrun swiftc for speech bridge helper");

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        panic!("failed to compile macOS speech helper: {stderr}");
    }

    println!(
        "cargo:rustc-env=WINGMAN_SPEECH_BRIDGE_BIN={}",
        helper_bin.display()
    );
    println!(
        "cargo:rustc-env=WINGMAN_SPEECH_BRIDGE_APP={}",
        helper_app.display()
    );
}

#[cfg(not(target_os = "macos"))]
fn compile_macos_speech_bridge() {}

fn main() {
    embed_macos_info_plist_for_dev_binary();
    compile_macos_speech_bridge();
    tauri_build::build();
}
