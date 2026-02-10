Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
	[Parameter(Position = 0)]
	[ValidateSet("build", "sign", "verify", "all", "help")]
	[string]$Action = "help",
	[string]$Target = "x86_64-pc-windows-msvc",
	[string]$DesktopDir = "",
	[switch]$SkipWebBuild,
	[switch]$DryRun,
	[string]$CertificatePath = "",
	[string]$CertificatePassword = "",
	[string]$CertificateThumbprint = "",
	[string]$TimestampUrl = "http://timestamp.digicert.com"
)

function Write-Usage {
	@"
Usage:
  windows-publish.ps1 <build|sign|verify|all> [options]
  windows-publish.ps1 help

Actions:
  build       Build web assets and Tauri Windows x64 artifacts (MSI + NSIS)
  sign        Sign Windows installers with signtool
  verify      Verify installer signatures with signtool
  all         Run build, sign, and verify

Options:
  -Target <triple>              Rust target triple (default: x86_64-pc-windows-msvc)
  -DesktopDir <path>            apps/desktop directory path (default: script parent ..)
  -SkipWebBuild                 Skip "bun run --cwd apps/desktop build:web"
  -DryRun                       Print commands without executing
  -CertificatePath <path>       PFX path for signing (fallback: WINDOWS_CERT_PATH)
  -CertificatePassword <value>  PFX password (fallback: WINDOWS_CERT_PASSWORD)
  -CertificateThumbprint <sha1> Certificate thumbprint in CurrentUser\My store (fallback: WINDOWS_CERT_THUMBPRINT)
  -TimestampUrl <url>           RFC3161 timestamp URL (default: http://timestamp.digicert.com)

Environment variables:
  WINDOWS_CERT_PATH
  WINDOWS_CERT_PASSWORD
  WINDOWS_CERT_THUMBPRINT
"@
}

function Invoke-Step {
	param(
		[Parameter(Mandatory = $true)]
		[string]$FilePath,
		[Parameter()]
		[string[]]$Arguments = @()
	)

	$display = $FilePath
	if ($Arguments.Count -gt 0) {
		$display = "$FilePath $($Arguments -join ' ')"
	}
	Write-Host "+ $display"
	if ($DryRun) {
		return
	}

	& $FilePath @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "Command failed ($LASTEXITCODE): $display"
	}
}

function Require-Command {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Name
	)
	$cmd = Get-Command $Name -ErrorAction SilentlyContinue
	if (-not $cmd) {
		throw "Missing command: $Name"
	}
}

if ($Action -eq "help") {
	Write-Usage
	exit 0
}

if ([string]::IsNullOrWhiteSpace($DesktopDir)) {
	$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
	$DesktopDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
}

$TauriDir = Join-Path $DesktopDir "src-tauri"
$BundleDir = Join-Path $TauriDir "target\$Target\release\bundle"

if ([string]::IsNullOrWhiteSpace($CertificatePath) -and $env:WINDOWS_CERT_PATH) {
	$CertificatePath = $env:WINDOWS_CERT_PATH
}
if ([string]::IsNullOrWhiteSpace($CertificatePassword) -and $env:WINDOWS_CERT_PASSWORD) {
	$CertificatePassword = $env:WINDOWS_CERT_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($CertificateThumbprint) -and $env:WINDOWS_CERT_THUMBPRINT) {
	$CertificateThumbprint = $env:WINDOWS_CERT_THUMBPRINT
}

function Build-Artifacts {
	Require-Command "bun"
	if (-not $SkipWebBuild) {
		Invoke-Step -FilePath "bun" -Arguments @("run", "--cwd", $DesktopDir, "build:web")
	}
	Invoke-Step -FilePath "bun" -Arguments @(
		"run",
		"--cwd",
		$DesktopDir,
		"tauri:build",
		"--",
		"--target",
		$Target,
		"--bundles",
		"msi,nsis"
	)
}

function Get-BundleArtifacts {
	$msiDir = Join-Path $BundleDir "msi"
	$nsisDir = Join-Path $BundleDir "nsis"
	$artifacts = @()

	if (Test-Path $msiDir) {
		$artifacts += Get-ChildItem -Path $msiDir -Filter "*.msi" -File
	}
	if (Test-Path $nsisDir) {
		$artifacts += Get-ChildItem -Path $nsisDir -Filter "*.exe" -File
	}

	return $artifacts
}

function Resolve-SignIdentityArgs {
	if (-not [string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
		return @("/sha1", $CertificateThumbprint, "/sm", "/s", "My")
	}
	if (-not [string]::IsNullOrWhiteSpace($CertificatePath)) {
		$args = @("/f", $CertificatePath)
		if (-not [string]::IsNullOrWhiteSpace($CertificatePassword)) {
			$args += @("/p", $CertificatePassword)
		}
		return $args
	}
	throw "Signing requires -CertificatePath or -CertificateThumbprint (or matching environment variables)."
}

function Sign-Artifacts {
	Require-Command "signtool.exe"
	$artifacts = Get-BundleArtifacts
	if ($artifacts.Count -eq 0) {
		throw "No Windows installer artifacts found under $BundleDir"
	}

	$identityArgs = Resolve-SignIdentityArgs
	foreach ($artifact in $artifacts) {
		Invoke-Step -FilePath "signtool.exe" -Arguments @(
			"sign",
			"/fd",
			"SHA256",
			"/tr",
			$TimestampUrl,
			"/td",
			"SHA256"
		) + $identityArgs + @($artifact.FullName)
	}
}

function Verify-Artifacts {
	Require-Command "signtool.exe"
	$artifacts = Get-BundleArtifacts
	if ($artifacts.Count -eq 0) {
		throw "No Windows installer artifacts found under $BundleDir"
	}

	foreach ($artifact in $artifacts) {
		Invoke-Step -FilePath "signtool.exe" -Arguments @(
			"verify",
			"/pa",
			"/v",
			$artifact.FullName
		)
	}
}

switch ($Action) {
	"build" {
		Build-Artifacts
	}
	"sign" {
		Sign-Artifacts
	}
	"verify" {
		Verify-Artifacts
	}
	"all" {
		Build-Artifacts
		Sign-Artifacts
		Verify-Artifacts
	}
	default {
		throw "Unsupported action: $Action"
	}
}

Write-Host "Done: $Action"
