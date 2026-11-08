// Copyright 2026 Nelson Martell
// SPDX-License-Identifier: MIT
//
// Caps Word adaptado al layout del SO, con indicador RGB.
//
// Oryx no genera este archivo: vive solo en la rama main, así que cada
// sincronización con Oryx puede reescribir keymap.c sin tocarlo. El código no
// depende de las capas del layout, solo de la configuración de abajo, y se
// puede copiar tal cual a cualquier otro layout.
//
// Uso: añade estas líneas al inicio de rules.mk (la línea OPT_DEFS solo hace
// falta si el SO no está en QWERTY):
//
//     SRC += custom_caps_word.c
//     OPT_DEFS += -DCW_OS_LAYOUT=CW_OS_SWITCH_BY_LAYER -DCW_OS_QWERTY_LAYER=1
//
// Qué hace:
//
//  1. Distingue los keycodes según el layout del SO. Con el SO en Colemak o
//     Colemak-DH, la «o» sale de KC_SCLN y el «;» de KC_P. Sin este ajuste,
//     Caps Word se apagaría al escribir la «o» y convertiría el «;» en «:».
//
//  2. Mientras Caps Word está activo, pinta cada tecla según su efecto. Las
//     teclas apagadas desactivan Caps Word al pulsarlas.
//
// Caps Word es para identificadores y constantes (MI_CONSTANTE), así que solo
// considera las letras de la A a la Z. AltGr (Ñ, vocales con tilde) y las tap
// dances lo desactivan.

#include QMK_KEYBOARD_H
#include "keymap_introspection.h" // combo_count(), combo_get()
#ifdef ORYX_ENABLE
#    include "oryx.h" // rawhid_state
#endif

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

// Layout del SO (CW_OS_LAYOUT):
//
//   CW_OS_QWERTY           SO en US QWERTY. Es el comportamiento estándar de
//                          QMK y el valor por defecto.
//   CW_OS_COLEMAK          SO siempre en US Colemak o Colemak-DH.
//   CW_OS_SWITCH_BY_LAYER  SO en Colemak, salvo cuando está activa la capa
//                          CW_OS_QWERTY_LAYER: la que se usa con el SO en US
//                          QWERTY. Ojo: Oryx renumera las capas si se borran
//                          o reordenan, así que hay que revisar el número.
#define CW_OS_QWERTY 0
#define CW_OS_COLEMAK 1
#define CW_OS_SWITCH_BY_LAYER 2

#ifndef CW_OS_LAYOUT
#    define CW_OS_LAYOUT CW_OS_QWERTY
#endif

#if CW_OS_LAYOUT == CW_OS_SWITCH_BY_LAYER
#    ifndef CW_OS_QWERTY_LAYER
#        error "CW_OS_SWITCH_BY_LAYER requiere definir CW_OS_QWERTY_LAYER (la capa que se usa con el SO en US QWERTY)."
#    endif
#elif CW_OS_LAYOUT != CW_OS_QWERTY && CW_OS_LAYOUT != CW_OS_COLEMAK
#    error "CW_OS_LAYOUT debe ser CW_OS_QWERTY, CW_OS_COLEMAK o CW_OS_SWITCH_BY_LAYER."
#endif

// Colores en HSV (0-255). El brillo final se escala con el brillo global.
#ifndef CW_COLOR_SHIFTED
#    define CW_COLOR_SHIFTED {85, 255, 255} // verde: se envían con Shift (letras; «-» pasa a «_»)
#endif
#ifndef CW_COLOR_KEEPS
#    define CW_COLOR_KEEPS {128, 255, 255} // cian: no cambian y mantienen Caps Word (números, Backspace, Delete)
#endif
#ifndef CW_COLOR_EXIT
#    define CW_COLOR_EXIT {0, 255, 255} // rojo: teclas del combo que activa/desactiva Caps Word
#endif

// ---------------------------------------------------------------------------
// Lógica de Caps Word
// ---------------------------------------------------------------------------

typedef enum {
    CW_KEY_BREAKS,  // desactiva Caps Word
    CW_KEY_SHIFTED, // continúa y se envía con Shift
    CW_KEY_KEEPS,   // continúa y se envía sin Shift
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
    // Teclas cuyo carácter depende del layout del SO.
    if (keycode == KC_SCLN) { // Colemak: «o»   QWERTY: «;»
        return os_in_colemak() ? CW_KEY_SHIFTED : CW_KEY_BREAKS;
    }
    if (keycode == KC_P) { // Colemak: «;»   QWERTY: «p»
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
// Indicador RGB
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

    // En mod-tap y layer-tap, a Caps Word le importa la acción al tocar.
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
    // Keymapp/Oryx está controlando los LEDs en este momento.
    if (rawhid_state.rgb_control) {
        return true;
    }
#    endif

    // keymap.c (Oryx) pinta los colores de la capa en rgb_matrix_indicators_user(),
    // que corre una vez por cuadro, justo antes de la llamada a esta función para
    // el último bloque de LEDs. En ese momento repintamos el teclado completo.
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

            // Keycode efectivo en esta posición, resolviendo las teclas
            // transparentes de las capas activas.
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
