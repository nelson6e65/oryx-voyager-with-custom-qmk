# Oryx Voyager with custom QMK

Firmware for my [ZSA Voyager](https://www.zsa.io/voyager). It combines my
[Oryx layout](https://configure.zsa.io/voyager/layouts/47Ged/latest), which I
edit in ZSA's graphical editor, with custom [QMK](https://qmk.fm) code for
features that Oryx does not offer.

This repository started from the
[oryx-with-custom-qmk](https://github.com/poulainpi/oryx-with-custom-qmk)
template. A GitHub Actions workflow fetches the layout from Oryx, merges it with
the custom code and builds the firmware.

## Custom features

### Caps Word for Colemak-DH

[Caps Word](https://docs.qmk.fm/features/caps_word) types the next word in
capital letters, which is handy for constants and identifiers such as
`MAX_RETRIES`. It turns itself off at the first key that cannot be part of a
word.

The main layer of this layout sends QWERTY keycodes, and the operating system
turns them into Colemak-DH with its US Colemak layout. QMK's Caps Word only
knows QWERTY, so it got two keys wrong on that layer:

- The key that types `o` sends `KC_SCLN`, so Caps Word took it for `;` and
  turned off.
- The key that types `;` sends `KC_P`, so Caps Word shifted it and typed `:`.

[`custom_caps_word.c`](layouts/voyager/47Ged/custom_caps_word.c) fixes both and
adds an RGB indicator. While Caps Word is on, the keys light up by what they do:

| Color | Keys                                                                          |
| ----- | ----------------------------------------------------------------------------- |
| Green | Letters, which Caps Word shifts, and `-`, which it turns into `_`.            |
| Cyan  | Numbers, Backspace, Delete and `_`, which keep Caps Word on without shifting. |
| Red   | The keys of the combo that toggles Caps Word (`.` + `,`).                     |
| Off   | Other keys. Most of them turn Caps Word off; layer keys do not.               |

Caps Word works only with A–Z. AltGr turns it off on purpose, because Ñ and
accented letters do not appear in identifiers. It also turns off after 10
seconds without a key press (QMK's default is 5).

#### Configuration

The module only needs to know when the operating system uses Colemak. Set
`CW_OS_LAYOUT` in the layout's `rules.mk`:

| Value                    | Use it when                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `CW_OS_QWERTY` (default) | The operating system uses QWERTY.                                                        |
| `CW_OS_COLEMAK`          | The operating system always uses Colemak.                                                |
| `CW_OS_SWITCH_BY_LAYER`  | The operating system uses Colemak, except while the layer in `CW_OS_QWERTY_LAYER` is on. |

This layout uses the third option. Its layer 1, "US fallback", is for when the
operating system uses US QWERTY. These lines at the top of
`layouts/voyager/47Ged/rules.mk` enable the module:

```make
SRC += custom_caps_word.c
OPT_DEFS += -DCW_OS_LAYOUT=CW_OS_SWITCH_BY_LAYER -DCW_OS_QWERTY_LAYER=1 -DCAPS_WORD_IDLE_TIMEOUT=10000
```

The colors are HSV values in `CW_COLOR_SHIFTED`, `CW_COLOR_KEEPS` and
`CW_COLOR_EXIT`, at the top of the file.

## How this repository works

Each layout lives in `layouts/<keyboard>/<layout_id>/`, here
[`layouts/voyager/47Ged/`](layouts/voyager/47Ged/), whose README describes the
layers and combos. That folder holds two kinds of files:

- The source that Oryx generates: `keymap.c`, `config.h`, `rules.mk` and
  `keymap.json`.
- The custom code: `custom_*.c` files, plus the lines at the top of `rules.mk`
  that add them to the build.

Two branches keep them apart:

- `oryx` holds the source as Oryx generates it, formatted with oxfmt (see
  [Formatting](#formatting)). Only the workflow commits to it.
- `main` holds the custom code and gets the Oryx changes by merging `oryx`.

Git applies each Oryx change on top of the custom code. To keep those merges
free of conflicts:

- Put custom code in separate files, and add lines only at the top of
  `rules.mk`, away from the lines that Oryx generates.
- Do not edit the files that Oryx generates. Change the layout in Oryx instead.
- Do not rewrite the published history of `oryx` or `main`.

## Day-to-day use

To change the layout:

1. Edit it in Oryx and click **Compile this layout**. The text in **Some notes
   about what you changed** becomes the commit message.
2. Run the **Fetch and build layout** workflow from the
   [Oryx Chrome extension](https://chromewebstore.google.com/detail/oryx-extension/bocjciklgnhkejkdfilcikhjfbmbcjal),
   from the **Actions** tab or from the terminal.
3. Run `git pull` on `main`.

To change the custom code:

1. Edit it on `main`.
2. Build and flash the firmware to test it:

   ```bash
   scripts/build.sh
   zapp flash build/zsa_voyager_47Ged.bin
   ```

3. Commit and push.

See [Building the firmware](docs/building.md) and
[Flashing the firmware](docs/flashing.md) for the details.

## Formatting

[oxfmt](https://www.npmjs.com/package/oxfmt) formats the Markdown, YAML and
JSON files:

```bash
nub install
nub run format        # format the files
nub run format:check  # only check them
```

The files that Oryx generates are formatted too. The workflow formats them before
it commits them to `oryx`, with the oxfmt version in `package.json`, so `oryx`
and `main` always share the same formatting and merges stay free of conflicts.
Only `keymap.json` changes, because oxfmt does not format C or Makefiles.

`.oxfmtrc.json` leaves out the workflow, which comes from the template.

## Updating from the template

To bring in fixes from the original template, add it as a remote once per clone
and merge it:

```bash
git remote add upstream https://github.com/poulainpi/oryx-with-custom-qmk.git
git fetch upstream
git merge upstream/main
```

Expect conflicts in the workflow, which stores layouts in `layouts/` here, and
in this README, which is specific to this repository.

## Credits

- [oryx-with-custom-qmk](https://github.com/poulainpi/oryx-with-custom-qmk) by
  Pierre Poulain, the template this repository comes from, and ZSA's
  [guide to custom QMK features](https://blog.zsa.io/oryx-custom-qmk-features).
- The [Oryx Chrome extension](https://chromewebstore.google.com/detail/oryx-extension/bocjciklgnhkejkdfilcikhjfbmbcjal)
  by [@nivekmai](https://github.com/nivekmai).

Licensed under the [MIT License](LICENSE.md).
