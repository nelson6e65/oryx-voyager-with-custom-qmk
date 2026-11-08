# Building the firmware

The firmware is built from the layout folder, `layouts/<keyboard>/<layout_id>/`
(for this repository, `layouts/voyager/47Ged/`). That folder holds two kinds of
files:

- **The source that Oryx generates**: `keymap.c`, `config.h`, `rules.mk` and
  `keymap.json`. The GitHub Actions workflow updates these files every time it
  runs.
- **The custom QMK code**: files such as `custom_caps_word.c`, plus the lines at
  the top of `rules.mk` that add them to the build.

There are three ways to build the firmware:

| Method                                    | Includes the latest Oryx changes | Builds uncommitted changes | Requirements                      |
| ----------------------------------------- | -------------------------------- | -------------------------- | --------------------------------- |
| [GitHub Actions](#github-actions)         | Yes                              | No                         | Changes pushed to GitHub          |
| [Local build script](#local-build-script) | No                               | Yes                        | Linux, about 1.6 GB of disk space |
| [Docker](#docker)                         | No                               | Yes                        | Docker, several GB of disk space  |

When the firmware is ready, see [Flashing the firmware](flashing.md).

## GitHub Actions

This is the main build method of the template. The **Fetch and build layout**
workflow does the following:

1. Downloads the latest Oryx source and commits it to the `oryx` branch.
2. Merges `oryx` into `main`, which holds the custom code.
3. Updates the `qmk_firmware` submodule to the firmware version that Oryx uses.
4. Builds the firmware in Docker and uploads it as an artifact.

You can start the workflow from the Oryx Chrome extension, from the **Actions**
tab, or with the GitHub CLI. Section 1 of [Flashing the firmware](flashing.md)
shows how to start it and download the result.

The workflow builds what is on GitHub. Local changes that you have not pushed
are not included.

## Local build script

`scripts/build.sh` builds the firmware on your computer. It builds the layout
folder as it is in your working tree, including uncommitted changes, so you can
test changes before you commit them.

The script does not download changes from Oryx. To include changes that you made
in Oryx, run the GitHub Actions workflow first and then pull the `main` branch.

### Requirements

- Linux on x86_64 or arm64.
- `git`, `curl`, `tar`, `make` and `python3` with the `venv` module. On Debian
  and Ubuntu, the `venv` module is in the `python3-venv` package.
- `dfu-suffix`, which comes with `dfu-util`. If `dfu-util` is not installed, the
  script extracts `dfu-suffix` from the `dnf` or `apt` package, without root.
- A keyboard with an ARM chip: Voyager, Moonlander, Planck EZ or ErgoDox EZ
  (STM32). The script does not support the ErgoDox EZ with an AVR chip
  (`ergodox_ez` and `ergodox_ez/m32u4/*`).
- An internet connection and about 1.6 GB of disk space for the first run.

### Usage

Run the script from anywhere in the repository:

```bash
scripts/build.sh
```

The script builds the layout set as the default in the workflow file
(`47Ged` for the `voyager`) and writes the firmware to
`build/zsa_voyager_47Ged.bin`. The `.gitignore` ignores the `build/` folder.

To build another layout, pass its ID and keyboard type as the workflow names
them. For example, this command builds `layouts/moonlander_revb/AbCdE/`:

```bash
scripts/build.sh AbCdE moonlander/revb
```

| Option               | Description                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `-f`, `--firmware N` | Build with QMK firmware version `N`, for example `25`. By default, the script asks Oryx which version the layout uses. |
| `-u`, `--update`     | Update the cached QMK firmware to the latest commit of its branch before building.                                     |
| `-h`, `--help`       | Show the help.                                                                                                         |

### What the script does

On every run, the script asks Oryx which QMK firmware version the layout uses,
as the workflow does. If Oryx cannot be reached, the script uses the newest
version in the cache.

The first run sets up the build tools in a cache folder:

1. Downloads the [xPack ARM toolchain](https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack)
   (about 240 MB) and verifies its SHA-256 checksum.
2. Clones the `firmwareN` branch of [ZSA's QMK firmware](https://github.com/zsa/qmk_firmware),
   with only the submodules that ARM keyboards need.
3. Creates a Python virtual environment with the QMK CLI.
4. Extracts `dfu-suffix`, if needed.

This takes about a minute on a fast connection. Later runs reuse the cache and
build in a few seconds.

To build, the script copies the layout folder to
`keyboards/zsa/<keyboard>/keymaps/<layout_id>` in the cached QMK firmware and
runs `make zsa/<keyboard>:<layout_id>`, as the workflow does.

### The cache folder

By default, the cache is in `~/.cache/oryx-with-custom-qmk` (or in
`$XDG_CACHE_HOME/oryx-with-custom-qmk`, if that variable is set). To use another
folder, set `BUILD_CACHE_DIR`:

```bash
BUILD_CACHE_DIR=/tmp/oryx-qmk-build scripts/build.sh
```

If `/tmp` is a tmpfs, as on Fedora, it uses RAM instead of disk, and its
contents are deleted when the computer restarts. The next build then sets up
the tools again.

The cache folder contains:

| Path                                 | Contents                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| `xpack-arm-none-eabi-gcc-<version>/` | The ARM toolchain.                                             |
| `qmk_firmware-firmware<N>/`          | ZSA's QMK firmware, one folder for each firmware version used. |
| `venv/`                              | The QMK CLI and its Python dependencies.                       |
| `dfu-util/`                          | `dfu-suffix`, if it had to be extracted.                       |

The script does not install system packages, and it keeps the QMK CLI away
from your own QMK settings (`~/.config/qmk`). To free the space or start over,
delete the cache folder:

```bash
rm -rf ~/.cache/oryx-with-custom-qmk
```

### Keeping QMK up to date

The script clones each firmware branch once and keeps building with that
commit. The workflow always builds with the latest commit of the branch. To
build with the latest commit locally too, run:

```bash
scripts/build.sh --update
```

When Oryx moves the layout to a new firmware version, the script clones the new
branch on its own.

## Docker

The `Dockerfile` in the repository describes the image that the workflow builds
with. You can run the same steps on your computer. This needs Docker, plus
several GB of disk space for the image and the full QMK firmware, with all its
submodules, in `qmk_firmware/`.

Replace `25` with the firmware version that the layout uses. `scripts/build.sh`
prints it, and the workflow shows it in the name of its "Update QMK firmware
submodule" step.

```bash
# Check out the firmware branch in the qmk_firmware submodule
git submodule update --init --remote --depth=1 --no-single-branch
git -C qmk_firmware checkout -B firmware25 origin/firmware25
git -C qmk_firmware submodule update --init --recursive

# Build the image
docker build -t qmk .

# Copy the layout folder and build it
rm -rf qmk_firmware/keyboards/zsa/voyager/keymaps/47Ged
cp -r layouts/voyager/47Ged qmk_firmware/keyboards/zsa/voyager/keymaps/
docker run -v ./qmk_firmware:/root --rm qmk /bin/sh -c "
  qmk setup zsa/qmk_firmware -b firmware25 -y
  make zsa/voyager:47Ged
"
mkdir -p build && cp qmk_firmware/zsa_voyager_47Ged.bin build/
```

These steps change the `qmk_firmware` submodule: they check out a new commit
and add build files. Leave those changes out of your commits. The workflow
keeps the submodule up to date on its own.

With rootful Docker, root owns the files that the container creates in
`qmk_firmware/`, so deleting them later requires `sudo`.
