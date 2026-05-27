// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import {
  BUTTON_CLASS_BY_APPEARANCE,
  BUTTON_SIZES,
  BUTTON_TONES,
  UI_DEFAULTS,
  resolveButtonAppearance,
  resolveVariant,
} from '../../design-system/variants.js';

export default function Button({
  variant,
  appearance,
  tone = UI_DEFAULTS.button.tone,
  size = UI_DEFAULTS.button.size,
  active = false,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  const resolvedAppearance = resolveButtonAppearance(appearance, variant);
  const resolvedTone = resolveVariant(tone, BUTTON_TONES, UI_DEFAULTS.button.tone);
  const resolvedSize = resolveVariant(size, BUTTON_SIZES, UI_DEFAULTS.button.size);
  const appearanceClass = BUTTON_CLASS_BY_APPEARANCE[resolvedAppearance];
  const classes = ['ui-button', appearanceClass, className].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      data-appearance={resolvedAppearance}
      data-tone={resolvedTone}
      data-size={resolvedSize}
      data-active={active ? 'true' : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
