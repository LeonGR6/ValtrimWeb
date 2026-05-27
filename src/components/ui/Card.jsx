// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { CARD_DENSITIES, CARD_SURFACES, UI_DEFAULTS, resolveVariant } from '../../design-system/variants.js';

export default function Card({
  as: Component = 'section',
  className = '',
  children,
  surface = UI_DEFAULTS.card.surface,
  density = UI_DEFAULTS.card.density,
  ...props
}) {
  const resolvedSurface = resolveVariant(surface, CARD_SURFACES, UI_DEFAULTS.card.surface);
  const resolvedDensity = resolveVariant(density, CARD_DENSITIES, UI_DEFAULTS.card.density);
  const classes = ['panel', 'ui-card', className].filter(Boolean).join(' ');

  return (
    <Component className={classes} data-surface={resolvedSurface} data-density={resolvedDensity} {...props}>
      {children}
    </Component>
  );
}
