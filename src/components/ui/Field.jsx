import {
  FIELD_DENSITIES,
  FIELD_LAYOUTS,
  FIELD_TONES,
  UI_DEFAULTS,
  resolveVariant,
} from '../../design-system/variants.js';

export default function Field({
  id,
  label,
  className = '',
  children,
  tone = UI_DEFAULTS.field.tone,
  density = UI_DEFAULTS.field.density,
  layout = UI_DEFAULTS.field.layout,
}) {
  const resolvedTone = resolveVariant(tone, FIELD_TONES, UI_DEFAULTS.field.tone);
  const resolvedDensity = resolveVariant(density, FIELD_DENSITIES, UI_DEFAULTS.field.density);
  const resolvedLayout = resolveVariant(layout, FIELD_LAYOUTS, UI_DEFAULTS.field.layout);
  const classes = ['field', 'ui-field', className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      data-tone={resolvedTone}
      data-density={resolvedDensity}
      data-layout={resolvedLayout}
    >
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
