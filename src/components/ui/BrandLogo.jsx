// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
/**
 * BrandLogo
 * Renders the Valtrim logo, choosing the variant that contrasts with the
 * active theme. The active variant is selected purely via CSS based on
 * `data-theme` on the <html> element, so no re-renders are needed when the
 * theme changes.
 *
 *   light theme → blue logo
 *   dark theme  → white logo
 */
export default function BrandLogo({ className = '', alt = 'Valtrim', size }) {
    const style = size ? { width: size, height: size } : undefined;
    const cls = ['brand-logo', className].filter(Boolean).join(' ');

    return (
        <>
            <img
                src="/Valtrim_Logo_Blue_Transparent.png"
                alt={alt}
                className={`${cls} brand-logo--light`}
                style={style}
                draggable={false}
            />
            <img
                src="/Valtrim_Logo_White_Transparent.png"
                alt=""
                aria-hidden="true"
                className={`${cls} brand-logo--dark`}
                style={style}
                draggable={false}
            />
        </>
    );
}
