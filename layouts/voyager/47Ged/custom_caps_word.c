// Copyright 2026 Nelson Martell
// SPDX-License-Identifier: MIT
//
// Caps Word adapted to the operating system's keyboard layout, with an RGB
// indicator.
//
// Oryx does not generate this file. It lives only on the main branch, so each
// sync with Oryx can rewrite keymap.c without touching it. The code does not
// depend on the layout's layers, only on the settings below, and can be copied
// as is to any other layout.
//
// Usage: add these lines at the top of rules.mk (the OPT_DEFS line is only
// needed if the operating system does not use QWERTY):
//
//     SRC += custom_caps_word.c
//     OPT_DEFS += -DCW_OS_LAYOUT=CW_OS_SWITCH_BY_LAYER -DCW_OS_QWERTY_LAYER=1
//
// What it does:
//
//  1. Treats keycodes according to the operating system's layout. With the
//     operating system in Colemak or Colemak-DH, "o" comes from KC_SCLN and
//     ";" from KC_P. Without this, Caps Word would turn off when typing "o" and
//     would turn ";" into ":".
//
//  2. While Caps Word is on, lights up each key by what it does. Most keys
//     left dark turn Caps Word off when pressed; layer keys do not.
//
// Caps Word is for identifiers and constants (MY_CONSTANT), so it only takes
// the letters A to Z into account. Tap dances turn it off. In this layout, that
// includes AltGr, which types Ñ and accented vowels.

#include QMK_KEYBOARD_H
#include "keymap_introspection.h" // combo_count(), combo_get()
#ifdef ORYX_ENABLE
#    include "oryx.h" // rawhid_state
#endif

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// Operating system layout (CW_OS_LAYOUT):
//
//   CW_OS_QWERTY           The operating system uses US QWERTY. This is QMK's
//                          standard behavior and the default.
//   CW_OS_COLEMAK          The operating system always uses US Colemak or
//                          Colemak-DH.
//   CW_OS_SWITCH_BY_LAYER  The operating system uses Colemak, except while
//                          layer CW_OS_QWERTY_LAYER is on: the layer used with
//                          the operating system in US QWERTY. Note: Oryx
//                          renumbers the layers when they are deleted or
//                          reordered, so check the number after such changes.
#define CW_OS_QWERTY 0
#define CW_OS_COLEMAK 1
#define CW_OS_SWITCH_BY_LAYER 2

#ifndef CW_OS_LAYOUT
#    define CW_OS_LAYOUT CW_OS_QWERTY
#endif

#if CW_OS_LAYOUT == CW_OS_SWITCH_BY_LAYER
#    ifndef CW_OS_QWERTY_LAYER
#        error "CW_OS_SWITCH_BY_LAYER requires CW_OS_QWERTY_LAYER (the layer used with the operating system in US QWERTY)."
#    endif
#elif CW_OS_LAYOUT != CW_OS_QWERTY && CW_OS_LAYOUT != CW_OS_COLEMAK
#    error "CW_OS_LAYOUT must be CW_OS_QWERTY, CW_OS_COLEMAK or CW_OS_SWITCH_BY_LAYER."
#endif

// Colors in HSV (0-255). The final brightness scales with the global brightness.
#ifndef CW_COLOR_SHIFTED
#    define CW_COLOR_SHIFTED {85, 255, 255} // green: sent with Shift (letters; "-" becomes "_")
#endif
#ifndef CW_COLOR_KEEPS
#    define CW_COLOR_KEEPS {128, 255, 255} // cyan: unchanged, keep Caps Word on (numbers, Backspace, Delete)
#endif
#ifndef CW_COLOR_EXIT
#    define CW_COLOR_EXIT {0, 255, 255} // red: keys of the combo that toggles Caps Word
#endif

// ---------------------------------------------------------------------------
// Caps Word logic
// ---------------------------------------------------------------------------

typedef enum {
    CW_KEY_BREAKS,  // turns Caps Word off
    CW_KEY_SHIFTED, // keeps Caps Word on and is sent with Shift
    CW_KEY_KEEPS,   // keeps Caps Word on and is sent without Shift
} cw_key_t;

static bool os_in_colemak(void) {
#if CW_OS_LAYOUT == CW_OS_COLEMAK
    return true;
#elif CW_OS_LAYOUT == CW_OS_SWITCH_BY_LAYER
    return !layer_state_is(CW_OS_QWERTY_LAYER);
#else
    return false;
#endif
}

static cw_key_t cw_classify(uint16_t keycode) {
    // Keys whose character depends on the operating system's layout.
    if (keycode == KC_SCLN) { // Colemak: "o"   QWERTY: ";"
        return os_in_colemak() ? CW_KEY_SHIFTED : CW_KEY_BREAKS;
    }
    if (keycode == KC_P) { // Colemak: ";"   QWERTY: "p"
        return os_in_colemak() ? CW_KEY_BREAKS : CW_KEY_SHIFTED;
    }

    switch (keycode) {
        case KC_A ... KC_Z:
        case KC_MINS:
            return CW_KEY_SHIFTED;

        case KC_1 ... KC_0:
        case KC_BSPC:
        case KC_DEL:
        case KC_UNDS:
            return CW_KEY_KEEPS;

        default:
            return CW_KEY_BREAKS;
    }
}

bool caps_word_press_user(uint16_t keycode) {
    switch (cw_classify(keycode)) {
        case CW_KEY_SHIFTED:
            add_weak_mods(MOD_BIT(KC_LSFT));
            return true;

        case CW_KEY_KEEPS:
            return true;

        default:
            return false;
    }
}

// ---------------------------------------------------------------------------
// RGB indicator
// ---------------------------------------------------------------------------

#ifdef RGB_MATRIX_ENABLE

static bool cw_is_toggle_combo_key(uint16_t keycode) {
#    ifdef COMBO_ENABLE
    for (uint16_t i = 0; i < combo_count(); i++) {
        const combo_t *combo = combo_get(i);
        if (combo->keycode != CW_TOGG) {
            continue;
        }
        for (const uint16_t *keys = combo->keys;; keys++) {
            const uint16_t key = pgm_read_word(keys);
            if (key == COMBO_END) {
                break;
            }
            if (key == keycode) {
                return true;
            }
        }
    }
#    endif
    return false;
}

static HSV cw_key_color(uint16_t keycode) {
    if (cw_is_toggle_combo_key(keycode)) {
        return (HSV)CW_COLOR_EXIT;
    }

    // For mod-tap and layer-tap keys, Caps Word cares about the tap action.
    if (IS_QK_MOD_TAP(keycode)) {
        keycode = QK_MOD_TAP_GET_TAP_KEYCODE(keycode);
    } else if (IS_QK_LAYER_TAP(keycode)) {
        keycode = QK_LAYER_TAP_GET_TAP_KEYCODE(keycode);
    }

    switch (cw_classify(keycode)) {
        case CW_KEY_SHIFTED:
            return (HSV)CW_COLOR_SHIFTED;
        case CW_KEY_KEEPS:
            return (HSV)CW_COLOR_KEEPS;
        default:
            return (HSV){0, 0, 0};
    }
}

bool rgb_matrix_indicators_advanced_user(uint8_t led_min, uint8_t led_max) {
    if (!is_caps_word_on()) {
        return true;
    }
#    ifdef ORYX_ENABLE
    // Keymapp or Oryx is controlling the LEDs right now.
    if (rawhid_state.rgb_control) {
        return true;
    }
#    endif

    // keymap.c (Oryx) paints the layer colors in rgb_matrix_indicators_user(),
    // which runs once per frame, right before this function is called for the
    // last chunk of LEDs. Repaint the whole keyboard at that point.
    if (led_max < RGB_MATRIX_LED_COUNT) {
        return true;
    }

    const uint8_t brightness = rgb_matrix_get_val();

    for (uint8_t row = 0; row < MATRIX_ROWS; row++) {
        for (uint8_t col = 0; col < MATRIX_COLS; col++) {
            const uint8_t led = g_led_config.matrix_co[row][col];
            if (led == NO_LED) {
                continue;
            }

            // Effective keycode at this position, resolving the transparent
            // keys of the active layers.
            const keypos_t pos     = {.row = row, .col = col};
            const uint16_t keycode = keymap_key_to_keycode(layer_switch_get_layer(pos), pos);

            HSV hsv = cw_key_color(keycode);
            hsv.v   = (uint16_t)hsv.v * brightness / UINT8_MAX;

            const RGB rgb = hsv_to_rgb(hsv);
            rgb_matrix_set_color(led, rgb.r, rgb.g, rgb.b);
        }
    }

    return true;
}

#endif // RGB_MATRIX_ENABLE
