// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
/**
 * Central variant contract for UI primitives.
 * Keep variant options, defaults, and resolvers in a single place.
 */

/** @typedef {'solid' | 'ghost' | 'segment'} ButtonAppearance */
/** @typedef {'neutral' | 'accent' | 'danger'} ButtonTone */
/** @typedef {'sm' | 'md' | 'lg'} ButtonSize */

/** @typedef {'default' | 'subtle' | 'elevated' | 'solid'} CardSurface */
/** @typedef {'compact' | 'md' | 'spacious'} CardDensity */

/** @typedef {'default' | 'success' | 'danger'} FieldTone */
/** @typedef {'compact' | 'md'} FieldDensity */
/** @typedef {'stack' | 'inline'} FieldLayout */

/** @typedef {'success' | 'error' | 'warning' | 'info' | 'neutral'} BadgeTone */
/** @typedef {'sm' | 'md'} BadgeSize */
/** @typedef {'soft' | 'solid'} BadgeEmphasis */

export const BUTTON_APPEARANCES = Object.freeze(['solid', 'ghost', 'segment']);
export const BUTTON_TONES = Object.freeze(['neutral', 'accent', 'danger']);
export const BUTTON_SIZES = Object.freeze(['sm', 'md', 'lg']);
export const BUTTON_CLASS_BY_APPEARANCE = Object.freeze({
    solid: 'primary-button',
    ghost: 'ghost-button',
    segment: 'segment-button',
});
export const BUTTON_LEGACY_VARIANT_MAP = Object.freeze({
    primary: 'solid',
    ghost: 'ghost',
    segment: 'segment',
});

export const CARD_SURFACES = Object.freeze(['default', 'subtle', 'elevated', 'solid']);
export const CARD_DENSITIES = Object.freeze(['compact', 'md', 'spacious']);

export const FIELD_TONES = Object.freeze(['default', 'success', 'danger']);
export const FIELD_DENSITIES = Object.freeze(['compact', 'md']);
export const FIELD_LAYOUTS = Object.freeze(['stack', 'inline']);

export const BADGE_TONES = Object.freeze(['success', 'error', 'warning', 'info', 'neutral']);
export const BADGE_SIZES = Object.freeze(['sm', 'md']);
export const BADGE_EMPHASIS = Object.freeze(['soft', 'solid']);

export const UI_DEFAULTS = Object.freeze({
    button: Object.freeze({ appearance: 'ghost', tone: 'neutral', size: 'md' }),
    card: Object.freeze({ surface: 'default', density: 'md' }),
    field: Object.freeze({ tone: 'default', density: 'md', layout: 'stack' }),
    badge: Object.freeze({ tone: 'success', size: 'md', emphasis: 'soft' }),
});

/**
 * @template {string} T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
export function resolveVariant(value, allowed, fallback) {
    return typeof value === 'string' && allowed.includes(/** @type {T} */(value))
        ? /** @type {T} */ (value)
        : fallback;
}

/**
 * @param {string | undefined} appearance
 * @param {string | undefined} legacyVariant
 * @returns {ButtonAppearance}
 */
export function resolveButtonAppearance(appearance, legacyVariant) {
    if (appearance) {
        return resolveVariant(appearance, BUTTON_APPEARANCES, UI_DEFAULTS.button.appearance);
    }

    if (legacyVariant && BUTTON_LEGACY_VARIANT_MAP[legacyVariant]) {
        return BUTTON_LEGACY_VARIANT_MAP[legacyVariant];
    }

    return UI_DEFAULTS.button.appearance;
}
