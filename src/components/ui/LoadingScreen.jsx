// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import BrandLogo from './BrandLogo.jsx';

export default function LoadingScreen({
  title,
  subtitle,
  compact = false,
  className = '',
}) {
  const classes = ['loading-screen', compact ? 'loading-screen--compact' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-screen__glow loading-screen__glow--top" />
      <div className="loading-screen__glow loading-screen__glow--bottom" />

      <div className="loading-screen__card">
        <div className="loading-screen__brand">
          <BrandLogo />
        </div>

        <div className="loading-screen__copy">
          <p className="eyebrow">Valtrim</p>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="loading-screen__meter" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
