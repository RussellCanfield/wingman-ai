#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$DESKTOP_DIR/src-tauri"
BUNDLE_DIR="${BUNDLE_DIR:-$TAURI_DIR/target/release/bundle}"

APP_NAME="${APP_NAME:-Wingman Companion}"
APP_PATH="${APP_PATH:-$BUNDLE_DIR/macos/$APP_NAME.app}"
DMG_PATH="${DMG_PATH:-}"
STAGE_DIR="${STAGE_DIR:-/tmp/wingman-sign-stage}"
IDENTITY="${IDENTITY:-}"
IDENTITY="${IDENTITY:-${MACOS_SIGN_IDENTITY:-}}"
NOTARY_PROFILE="${NOTARY_PROFILE:-wingman-notary}"
SKIP_WEB_BUILD=0
DRY_RUN=0
ACTION=""

print_usage() {
	cat <<EOF
Usage:
  $(basename "$0") <build|sign|notarize|verify|all> [options]
  $(basename "$0") --help

Actions:
  build       Build web assets and Tauri macOS artifacts
  sign        Sign app, repackage DMG, then sign DMG
  notarize    Submit DMG to Apple notary and staple app + DMG
  verify      Verify signatures, Gatekeeper acceptance, staple, and checksum
  all         Run build, sign, notarize, verify

Options:
  --identity <value>         Developer ID Application identity
  --notary-profile <value>   notarytool keychain profile (default: wingman-notary)
  --app <path>               App bundle path (default: $APP_PATH)
  --dmg <path>               DMG path (default: auto-detect under bundle/dmg; sign creates one if missing)
  --stage-dir <path>         Temporary folder for DMG repackaging (default: $STAGE_DIR)
  --skip-web-build           Skip "bun run --cwd apps/desktop build:web"
  --dry-run                  Print commands without executing
  --help                     Show this message

Environment variables:
  IDENTITY, MACOS_SIGN_IDENTITY, NOTARY_PROFILE, APP_PATH, DMG_PATH, STAGE_DIR, APP_NAME, BUNDLE_DIR
EOF
}

log() {
	printf '%s\n' "$*"
}

fail() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

run() {
	log "+ $*"
	if [[ "$DRY_RUN" -eq 0 ]]; then
		"$@"
	fi
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

default_dmg_path() {
	local app_dir
	local app_bundle_name
	local app_name

	app_dir="$(cd -- "$(dirname -- "$APP_PATH")" && pwd)"
	app_bundle_name="$(basename -- "$APP_PATH")"
	app_name="${app_bundle_name%.app}"
	if [[ -z "$app_name" || "$app_name" == "$app_bundle_name" ]]; then
		app_name="$APP_NAME"
	fi

	if [[ "$(basename -- "$app_dir")" == "macos" ]]; then
		printf '%s/dmg/%s.dmg\n' "$(cd -- "$app_dir/.." && pwd)" "$app_name"
		return
	fi

	printf '%s/%s.dmg\n' "$app_dir" "$app_name"
}

resolve_dmg_path() {
	local allow_missing="${1:-0}"
	if [[ -n "$DMG_PATH" ]]; then
		if [[ "$allow_missing" -eq 1 ]]; then
			return
		fi
		[[ -f "$DMG_PATH" ]] || fail "DMG not found: $DMG_PATH"
		return
	fi

	shopt -s nullglob
	local candidates=("$BUNDLE_DIR/dmg/${APP_NAME}"_*.dmg)
	if [[ ${#candidates[@]} -eq 0 ]]; then
		candidates=("$BUNDLE_DIR/dmg/"*.dmg)
	fi
	shopt -u nullglob

	if [[ ${#candidates[@]} -eq 0 ]]; then
		if [[ "$allow_missing" -eq 1 ]]; then
			DMG_PATH="$(default_dmg_path)"
			return
		fi
		fail "No DMG found under $BUNDLE_DIR/dmg"
	fi

	if [[ ${#candidates[@]} -eq 1 ]]; then
		DMG_PATH="${candidates[0]}"
		return
	fi

	DMG_PATH="$(ls -t "${candidates[@]}" | head -n 1)"
}

build_artifacts() {
	require_cmd bun
	if [[ "$SKIP_WEB_BUILD" -eq 0 ]]; then
		run bun run --cwd "$DESKTOP_DIR" build:web
	fi
	run bun run --cwd "$DESKTOP_DIR" tauri:build
}

resolve_signing_identity() {
	if [[ -n "$IDENTITY" ]]; then
		return
	fi

	require_cmd security

	local count=0
	local identities_text=""

	identities_text="$(
		security find-identity -v -p codesigning 2>/dev/null \
			| sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' \
			| awk '!seen[$0]++'
	)"

	if [[ -z "$identities_text" ]]; then
		fail "No Developer ID Application identity found. Pass --identity or set IDENTITY."
	fi

	count="$(printf '%s\n' "$identities_text" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
	if [[ "$count" -gt 1 ]]; then
		log "Found multiple Developer ID Application identities:"
		while IFS= read -r identity; do
			[[ -n "$identity" ]] || continue
			log "  - $identity"
		done <<< "$identities_text"
		fail "Multiple signing identities found. Pass --identity to choose one."
	fi

	IDENTITY="$identities_text"
	log "Using signing identity: $IDENTITY"
}

sign_artifacts() {
	require_cmd codesign
	require_cmd hdiutil
	require_cmd ditto
	require_cmd xattr
	resolve_signing_identity
	[[ -d "$APP_PATH" ]] || fail "App bundle not found: $APP_PATH"
	resolve_dmg_path 1

	local app_bundle_name
	local app_stage_path
	local temp_rw_dmg
	local mount_dir
	local size_kb
	local size_mb
	local temp_root
	local detached=0

	app_bundle_name="$(basename -- "$APP_PATH")"
	app_stage_path="$STAGE_DIR/$app_bundle_name"
	temp_root="${TMPDIR:-/tmp}"
	temp_rw_dmg="$(mktemp -u "$temp_root/wingman-dmg-rw.XXXXXX.dmg")"
	mount_dir="$(mktemp -d "$temp_root/wingman-dmg-mount.XXXXXX")"
	size_kb="$(du -sk "$APP_PATH" | awk '{print $1}')"
	size_mb="$(( ((size_kb + 1023) / 1024) + 128 ))"

	run codesign --force --deep --options runtime --timestamp --sign "$IDENTITY" "$APP_PATH"
	run codesign --verify --deep --strict --verbose=2 "$APP_PATH"

	run rm -rf "$STAGE_DIR"
	run mkdir -p "$STAGE_DIR"
	run mkdir -p "$(dirname -- "$DMG_PATH")"
	run rm -f "$temp_rw_dmg"
	run ditto "$APP_PATH" "$app_stage_path"
	run xattr -cr "$app_stage_path"
	run hdiutil create -size "${size_mb}m" -fs HFS+ -volname "$APP_NAME" -ov "$temp_rw_dmg"
	if [[ "$DRY_RUN" -eq 0 ]]; then
		trap 'if [[ $detached -eq 0 ]]; then hdiutil detach "$mount_dir" >/dev/null 2>&1 || true; fi; rm -f "$temp_rw_dmg"; rm -rf "$mount_dir"' RETURN
	fi
	run hdiutil attach "$temp_rw_dmg" -mountpoint "$mount_dir" -nobrowse -noverify
	run ditto "$app_stage_path" "$mount_dir/$app_bundle_name"
	run hdiutil detach "$mount_dir"
	detached=1
	run hdiutil convert "$temp_rw_dmg" -ov -format UDZO -o "$DMG_PATH"
	run codesign --force --timestamp --sign "$IDENTITY" "$DMG_PATH"
	if [[ "$DRY_RUN" -eq 0 ]]; then
		trap - RETURN
	fi
	run rm -f "$temp_rw_dmg"
	run rm -rf "$mount_dir"
}

notarize_artifacts() {
	require_cmd xcrun
	[[ -d "$APP_PATH" ]] || fail "App bundle not found: $APP_PATH"
	resolve_dmg_path

	run xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
	run xcrun stapler staple "$APP_PATH"
	run xcrun stapler staple "$DMG_PATH"
}

verify_artifacts() {
	require_cmd codesign
	require_cmd spctl
	require_cmd shasum
	require_cmd xcrun
	[[ -d "$APP_PATH" ]] || fail "App bundle not found: $APP_PATH"
	resolve_dmg_path

	run codesign --verify --deep --strict --verbose=2 "$APP_PATH"
	run spctl -a -vvv -t install "$DMG_PATH"
	run xcrun stapler validate "$DMG_PATH"
	run shasum -a 256 "$DMG_PATH"
}

if [[ $# -eq 0 ]]; then
	print_usage
	exit 1
fi

while [[ $# -gt 0 ]]; do
	case "$1" in
	build|sign|notarize|verify|all)
		[[ -z "$ACTION" ]] || fail "Only one action may be provided"
		ACTION="$1"
		shift
		;;
	--identity)
		IDENTITY="${2:-}"
		shift 2
		;;
	--notary-profile)
		NOTARY_PROFILE="${2:-}"
		shift 2
		;;
	--app)
		APP_PATH="${2:-}"
		shift 2
		;;
	--dmg)
		DMG_PATH="${2:-}"
		shift 2
		;;
	--stage-dir)
		STAGE_DIR="${2:-}"
		shift 2
		;;
	--skip-web-build)
		SKIP_WEB_BUILD=1
		shift
		;;
	--dry-run)
		DRY_RUN=1
		shift
		;;
	--help|-h)
		print_usage
		exit 0
		;;
	*)
		fail "Unknown argument: $1"
		;;
	esac
done

[[ -n "$ACTION" ]] || fail "Missing action"

case "$ACTION" in
build)
	build_artifacts
	;;
sign)
	sign_artifacts
	;;
notarize)
	notarize_artifacts
	;;
verify)
	verify_artifacts
	;;
all)
	build_artifacts
	sign_artifacts
	notarize_artifacts
	verify_artifacts
	;;
*)
	fail "Unsupported action: $ACTION"
	;;
esac

log "Done: $ACTION"
