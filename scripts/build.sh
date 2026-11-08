#!/usr/bin/env bash
# Builds the firmware locally, without Docker.
#
# The first run downloads the ARM toolchain, ZSA's QMK firmware and the QMK CLI
# into a cache folder outside the repository. Later runs reuse them and only
# compile the layout.
#
# Run `scripts/build.sh --help` for usage. See docs/building.md for details.

set -euo pipefail

readonly TOOLCHAIN_VERSION="13.3.1-1.1"
readonly QMK_REPOSITORY="https://github.com/zsa/qmk_firmware.git"
# Only the submodules that ARM (ChibiOS) keyboards need.
readonly QMK_SUBMODULES=(lib/chibios lib/chibios-contrib lib/printf)
readonly ORYX_API="https://oryx.zsa.io/graphql"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow_file="${repo_root}/.github/workflows/fetch-and-build-layout.yml"
cache_dir="${BUILD_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME}/.cache}/oryx-with-custom-qmk}"

usage() {
  cat <<EOF
Usage: scripts/build.sh [options] [layout_id [keyboard]]

Builds layouts/<keyboard>/<layout_id>/ and copies the firmware to build/.
The default layout_id and keyboard are the defaults of the workflow
(.github/workflows/fetch-and-build-layout.yml).

Arguments:
  layout_id         Oryx layout ID, for example 47Ged.
  keyboard          Keyboard type as the workflow names it, for example
                    voyager or moonlander/revb.

Options:
  -f, --firmware N  Build with QMK firmware version N, for example 25.
                    By default, the script asks Oryx which version the layout
                    uses, like the workflow does.
  -u, --update      Update the cached QMK firmware to the latest commit of its
                    branch before building.
  -h, --help        Show this help.

Environment:
  BUILD_CACHE_DIR   Folder for the toolchain, QMK firmware and QMK CLI
                    (about 1.6 GB). Current value: ${cache_dir}
EOF
}

log() { printf '==> %s\n' "$*" >&2; }
die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# Prints the default value of a workflow_dispatch input.
workflow_default() {
  [[ -f $workflow_file ]] || return 0
  awk -v input="$1" '
    $1 == input ":" { found = 1; next }
    found && $1 == "default:" { gsub(/"/, "", $2); print $2; exit }
  ' "$workflow_file"
}

# Asks Oryx for the QMK firmware version of the layout's latest revision.
oryx_firmware_version() {
  local query
  query="$(printf '{"query":"query getLayout($hashId: String!, $revisionId: String!, $geometry: String) {layout(hashId: $hashId, geometry: $geometry, revisionId: $revisionId) {revision {qmkVersion}}}","variables":{"hashId":"%s","geometry":"%s","revisionId":"latest"}}' \
    "$layout_id" "$keyboard")"
  curl -sSf --max-time 20 "$ORYX_API" --header 'Content-Type: application/json' --data "$query" 2>/dev/null |
    python3 -I -c 'import json, sys; print(round(float(json.load(sys.stdin)["data"]["layout"]["revision"]["qmkVersion"])))' 2>/dev/null
}

# Prints the highest QMK firmware version already in the cache, if any.
cached_firmware_version() {
  find "$cache_dir" -mindepth 1 -maxdepth 1 -type d -name 'qmk_firmware-firmware*' -printf '%f\n' 2>/dev/null |
    sed 's/^qmk_firmware-firmware//' | grep -E '^[0-9]+$' | sort -n | tail -n 1 || true
}

setup_toolchain() {
  toolchain_dir="${cache_dir}/xpack-arm-none-eabi-gcc-${TOOLCHAIN_VERSION}"
  [[ -x ${toolchain_dir}/bin/arm-none-eabi-gcc ]] && return

  local archive="xpack-arm-none-eabi-gcc-${TOOLCHAIN_VERSION}-${toolchain_platform}.tar.gz"
  local url="https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v${TOOLCHAIN_VERSION}/${archive}"
  local partial="${toolchain_dir}.partial"

  log "Downloading the ARM toolchain (xPack arm-none-eabi-gcc ${TOOLCHAIN_VERSION}, about 240 MB)"
  rm -rf "$partial"
  mkdir -p "$partial"
  # --retry covers temporary server errors, such as GitHub's 502 and 504 responses.
  curl -sSfL --retry 3 --retry-delay 10 "$url" -o "${partial}/${archive}" ||
    die "could not download the toolchain from ${url}. If GitHub is having problems, try again later."
  curl -sSfL --retry 3 --retry-delay 10 "${url}.sha" -o "${partial}/${archive}.sha" ||
    die "could not download the toolchain checksum from ${url}.sha"
  (cd "$partial" && sha256sum --check --quiet "${archive}.sha") || die "the toolchain download failed its checksum"
  tar -xzf "${partial}/${archive}" -C "$partial" --strip-components=1
  rm "${partial}/${archive}" "${partial}/${archive}.sha"
  mv "$partial" "$toolchain_dir"
}

setup_qmk() {
  local branch="firmware${firmware_version}"
  qmk_dir="${cache_dir}/qmk_firmware-${branch}"

  if [[ ! -d $qmk_dir ]]; then
    local partial="${qmk_dir}.partial"
    log "Cloning ZSA's QMK firmware (branch ${branch})"
    rm -rf "$partial"
    git clone --quiet --depth 1 --branch "$branch" "$QMK_REPOSITORY" "$partial"
    git -C "$partial" submodule update --quiet --init --depth 1 "${QMK_SUBMODULES[@]}"
    mv "$partial" "$qmk_dir"
  elif [[ $update == true ]]; then
    log "Updating QMK firmware (branch ${branch})"
    git -C "$qmk_dir" fetch --quiet --depth 1 origin "$branch"
    git -C "$qmk_dir" reset --quiet --hard FETCH_HEAD
    git -C "$qmk_dir" submodule update --quiet --init --depth 1 "${QMK_SUBMODULES[@]}"
  fi
}

setup_python() {
  venv_dir="${cache_dir}/venv"
  local requirements="${qmk_dir}/requirements.txt"
  local installed="${venv_dir}/.requirements.txt"

  # Reinstall only when the QMK firmware asks for different Python packages.
  if [[ -f $installed ]] && cmp -s "$requirements" "$installed"; then
    return
  fi

  log "Installing the QMK CLI and its Python dependencies"
  [[ -x ${venv_dir}/bin/python ]] || python3 -m venv "$venv_dir"
  "${venv_dir}/bin/pip" install --quiet --disable-pip-version-check --no-cache-dir -r "$requirements" qmk
  cp "$requirements" "$installed"
}

# QMK runs dfu-suffix to finish the .bin file. If dfu-util is not installed,
# extract it from the distribution's package, which needs no root.
setup_dfu_suffix() {
  dfu_bin_dir=""
  command -v dfu-suffix >/dev/null && return

  local dfu_dir="${cache_dir}/dfu-util"
  dfu_bin_dir="${dfu_dir}/usr/bin"
  [[ -x ${dfu_bin_dir}/dfu-suffix ]] && return

  local partial="${dfu_dir}.partial"
  rm -rf "$partial"
  mkdir -p "$partial"
  if command -v dnf >/dev/null && command -v rpm2cpio >/dev/null && command -v cpio >/dev/null; then
    log "Extracting dfu-suffix from the dfu-util package"
    (cd "$partial" && dnf download --quiet dfu-util >/dev/null && rpm2cpio dfu-util-*.rpm | cpio -idm --quiet && rm dfu-util-*.rpm)
  elif command -v apt-get >/dev/null && command -v dpkg-deb >/dev/null; then
    log "Extracting dfu-suffix from the dfu-util package"
    (cd "$partial" && apt-get download -qq dfu-util && dpkg-deb -x dfu-util_*.deb . && rm dfu-util_*.deb)
  else
    rm -rf "$partial"
    die "dfu-suffix not found. Install dfu-util with your package manager and try again."
  fi
  [[ -x ${partial}/usr/bin/dfu-suffix ]] || die "could not extract dfu-suffix. Install dfu-util with your package manager and try again."
  mv "$partial" "$dfu_dir"
}

build_layout() {
  local keyboards_dir make_target
  # Since firmware 24, ZSA keyboards live under keyboards/zsa (same as the workflow).
  if ((firmware_version >= 24)); then
    keyboards_dir="${qmk_dir}/keyboards/zsa"
    make_target="zsa/${keyboard}:${layout_id}"
  else
    keyboards_dir="${qmk_dir}/keyboards"
    make_target="${keyboard}:${layout_id}"
  fi
  [[ -d ${keyboards_dir}/${keyboard} ]] || die "QMK firmware ${firmware_version} has no keyboard named ${keyboard}"

  local keymap_dir="${keyboards_dir}/${keyboard}/keymaps/${layout_id}"
  rm -rf "$keymap_dir"
  mkdir -p "$(dirname "$keymap_dir")"
  cp -r "$layout_dir" "$keymap_dir"

  local firmware_name="${normalized_keyboard}_${layout_id}"
  rm -f "${qmk_dir}"/*"${firmware_name}".{bin,hex}

  log "Building ${make_target} with QMK firmware ${firmware_version}"
  (
    cd "$qmk_dir"
    export PATH="${dfu_bin_dir:+${dfu_bin_dir}:}${venv_dir}/bin:${toolchain_dir}/bin:${PATH}"
    # Keep the QMK CLI away from the user's own QMK setup.
    export QMK_HOME="$qmk_dir" XDG_CONFIG_HOME="${cache_dir}/config" XDG_CACHE_HOME="${cache_dir}/cache"
    # --output-sync keeps the output of parallel jobs from mixing, as `qmk compile` does.
    make -j"$(nproc)" --output-sync=target "$make_target"
  )

  local firmware_file
  firmware_file="$(find "$qmk_dir" -maxdepth 1 -type f \( -name "*${firmware_name}.bin" -o -name "*${firmware_name}.hex" \) -print -quit)"
  [[ -n $firmware_file ]] || die "the build finished, but no firmware file was found in ${qmk_dir}"

  mkdir -p "${repo_root}/build"
  cp "$firmware_file" "${repo_root}/build/"
  log "Firmware ready: build/$(basename "$firmware_file")"
}

# --- Arguments ---

firmware_version=""
update=false
positional=()
while (($#)); do
  case "$1" in
    -f | --firmware)
      (($# >= 2)) || die "$1 needs a value"
      firmware_version="$2"
      shift 2
      ;;
    --firmware=*)
      firmware_version="${1#*=}"
      shift
      ;;
    -u | --update)
      update=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done
((${#positional[@]} <= 2)) || die "too many arguments (see --help)"

layout_id="${positional[0]:-$(workflow_default layout_id)}"
keyboard="${positional[1]:-$(workflow_default layout_geometry)}"
[[ -n $layout_id && -n $keyboard ]] || die "pass the layout ID and the keyboard type (see --help)"
[[ -z $firmware_version || $firmware_version =~ ^[0-9]+$ ]] || die "the firmware version must be a number, for example 25"

normalized_keyboard="${keyboard//\//_}"
layout_dir="${repo_root}/layouts/${normalized_keyboard}/${layout_id}"

# --- Checks ---

[[ -d $layout_dir ]] || die "layout folder not found: layouts/${normalized_keyboard}/${layout_id}"
[[ -f ${layout_dir}/keymap.c ]] ||
  die "layouts/${normalized_keyboard}/${layout_id} has no keymap.c. Run the Fetch and build layout workflow once to get the Oryx source, then pull the main branch."

case "$keyboard" in
  ergodox_ez | ergodox_ez/m32u4*)
    die "${keyboard} uses an AVR chip, and this script only supports ARM keyboards. Build it with GitHub Actions or Docker instead (see docs/building.md)."
    ;;
esac

[[ $(uname -s) == Linux ]] || die "this script supports Linux only. Build with GitHub Actions or Docker instead (see docs/building.md)."
case "$(uname -m)" in
  x86_64) toolchain_platform="linux-x64" ;;
  aarch64 | arm64) toolchain_platform="linux-arm64" ;;
  *) die "unsupported CPU architecture: $(uname -m)" ;;
esac

for cmd in git curl tar sha256sum python3 make; do
  command -v "$cmd" >/dev/null || die "missing required command: ${cmd}"
done

# --- Build ---

if [[ -z $firmware_version ]]; then
  log "Asking Oryx which QMK firmware version layout ${layout_id} uses"
  if ! firmware_version="$(oryx_firmware_version)" || [[ -z $firmware_version ]]; then
    firmware_version="$(cached_firmware_version)"
    [[ -n $firmware_version ]] ||
      die "could not get the firmware version from Oryx (is the layout public?). Pass it with --firmware, for example --firmware 25."
    log "Warning: could not get the firmware version from Oryx, so using cached QMK firmware ${firmware_version}"
  fi
fi

log "Layout layouts/${normalized_keyboard}/${layout_id}, QMK firmware ${firmware_version}, cache ${cache_dir}"
mkdir -p "$cache_dir"
setup_toolchain
setup_qmk
setup_python
setup_dfu_suffix
build_layout
