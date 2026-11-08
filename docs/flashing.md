# Flashing the firmware

This repository builds a single firmware file for the ZSA Voyager: the Oryx
layout `47Ged` merged with the custom QMK code in `layouts/voyager/47Ged/`. You can flash that
`.bin` file with either of these tools:

- **[Keymapp](https://www.zsa.io/keymapp)**: ZSA's desktop app.
- **[Zapp](https://github.com/zsa/zapp)**: ZSA's command-line tool.

Both tools flash the same file, so you can use either one. Nothing in the
repository or the build workflow depends on which one you pick.

## 1. Get the firmware

### From GitHub Actions

The **Fetch and build layout** workflow pulls the latest Oryx changes, merges
them with the custom code and builds the firmware. You can start it from the
Oryx Chrome extension, from the **Actions** tab, or from the terminal:

```bash
gh workflow run fetch-and-build-layout.yml -f layout_id=47Ged -f layout_geometry=voyager
gh run watch
```

The workflow uploads the firmware as an artifact named `voyager_47Ged`. Run this
from the repository root to download the latest one into `build/`:

```bash
gh run download --name voyager_47Ged --dir build
```

This gives you `build/zsa_voyager_47Ged.bin`.

### From a local build

`scripts/build.sh` builds the firmware on your computer and writes it to
`build/`:

```bash
scripts/build.sh
```

This gives you `build/zsa_voyager_47Ged.bin`. See
[Building the firmware](building.md) for the requirements and options, and for
building with Docker.

The `.gitignore` ignores the `build/` folder and all firmware files (`*.bin`,
`*.hex`).

## 2. Linux prerequisites (one-time setup)

Flashing without `sudo` requires ZSA's udev rules. Follow the
[Linux install guide](https://github.com/zsa/wally/wiki/Linux-install) and make
sure your user belongs to the `plugdev` group.

Check the current setup with:

```bash
ls /etc/udev/rules.d/50-zsa.rules   # the rules file exists
id -nG | grep -w plugdev            # your user is in plugdev
```

## 3. Enter bootloader mode

The layout has no `QK_BOOT` key, so you have to press the Voyager's physical
reset button with a paperclip. Keymapp shows where the button is during the
flashing flow.

Both tools wait for the keyboard to enter bootloader mode. Start the flash
first, then press the reset button.

## 4. Flash

### Option A: Keymapp (GUI)

1. Open Keymapp and go to the flashing section in the sidebar.
2. Select the firmware file, for example `build/zsa_voyager_47Ged.bin`.
3. Press the reset button when Keymapp asks for it.
4. Wait until the flash finishes. The keyboard restarts on its own.

### Option B: Zapp (CLI)

Install the prebuilt binary into `~/.local/bin`. Check the
[releases page](https://github.com/zsa/zapp/releases) for newer versions.

```bash
curl -sSfL https://github.com/zsa/zapp/releases/download/v1.0.2/zapp-linux-x86_64.tar.gz \
  | tar -xz -C ~/.local/bin zapp
zapp --version
```

Flash:

```bash
zapp flash build/zsa_voyager_47Ged.bin
```

Zapp loads the file and waits for the keyboard. Press the reset button, and
Zapp flashes the firmware with a progress bar.

> [!WARNING]
> Do not run `zapp update`, and do not pass an Oryx URL to `zapp flash`, to
> install this firmware. Both download and flash the firmware compiled by Oryx,
> which does **not** include the custom QMK code. `zapp update` finds the
> layout through the keyboard's USB serial number (`47Ged/...`), and the custom
> firmware keeps that serial number. Always flash a local `.bin` file built by
> this repository.

#### Using Zapp with Keymapp running

You do not need to quit Keymapp. Keymapp can stay open in the background, for
example through its autostart entry. Just avoid having Keymapp on its flashing
screen while Zapp is flashing, so the two tools do not compete for the
keyboard.

If Zapp cannot open the device (for example, it reports a "busy" or
"access denied" error), quit Keymapp and try again. The keyboard stays in
bootloader mode and keeps waiting for the firmware.

### Option C: dfu-util

QMK flashes the Voyager with `dfu-util`. You can run the same command directly:

```bash
sudo dnf install dfu-util   # or your distribution's equivalent
dfu-util -w -d 3297:0791 -a 0 -s 0x08002000:leave -D build/zsa_voyager_47Ged.bin
```

Here is what each flag does:

- `-w` waits for the bootloader.
- `-d 3297:0791` is the Voyager's bootloader USB ID.
- `0x08002000` is where the application starts in flash memory.
- `:leave` restarts the keyboard after flashing.

## Rolling back to the plain Oryx firmware

To remove the custom code and go back to the layout exactly as Oryx compiles
it, use either of these:

- Download the firmware from Oryx and flash it with Keymapp or Zapp.
- Let Zapp download and flash it:

  ```bash
  zapp flash https://configure.zsa.io/voyager/layouts/47Ged/latest
  ```

To install the custom firmware again, flash the `.bin` built by this repository.
