# Voyager layout 47Ged

My layout for the [ZSA Voyager](https://www.zsa.io/voyager): Colemak-DH, with a
fallback layer for computers set to US QWERTY, and Spanish characters through
AltGr. [Oryx](https://configure.zsa.io/voyager/layouts/47Ged/latest) shows the
full keymap, with every layer and key.

## Operating system setup

The main layer sends QWERTY keycodes and relies on the operating system to turn
them into Colemak-DH. The operating system needs two keyboard layouts:

- **US Colemak** (`us(colemak)` in XKB) for everyday use. Its AltGr types the
  Spanish characters: AltGr+N types `ñ`, AltGr plus a vowel types the vowel with
  an accent, and AltGr+Y types `ü`.
- **US QWERTY** (`us`) as a fallback. With it, turn on the US Fbk layer, which
  types Colemak-DH on its own, without the Spanish characters.

## Layers

| Layer | Name    | Use                                                    |
| ----- | ------- | ------------------------------------------------------ |
| 0     | Colemak | Main layer, for an operating system set to US Colemak. |
| 1     | US Fbk  | Colemak-DH for an operating system set to US QWERTY.   |

Oryx shows the other layers: Fn+Symb (2), Nav (3), LoL (4), Numpad (5) and
LeftPlay (6).

## Combos

| Keys              | Action                  |
| ----------------- | ----------------------- |
| `` ` `` + `1`     | Escape                  |
| `0` + `8`         | Toggle layer 4 (LoL)    |
| `0` + `9`         | Toggle layer 1 (US Fbk) |
| `.` + `,`         | Toggle Caps Word        |
| Space + Backspace | Toggle layer 5 (Numpad) |

## Custom code

- [`custom_caps_word.c`](custom_caps_word.c) adapts Caps Word to Colemak-DH and
  adds an RGB indicator. The repository's
  [README](../../../README.md#caps-word-for-colemak-dh) explains how it works.
- The lines at the top of [`rules.mk`](rules.mk) add the module to the build.
  Because layer 1 is the one for US QWERTY, they set `CW_OS_SWITCH_BY_LAYER`
  with `CW_OS_QWERTY_LAYER=1`. They also keep Caps Word on for 10 seconds
  without a key press, instead of QMK's 5.

Oryx generates the other files in this folder. Do not edit them; change the
layout in Oryx instead.
