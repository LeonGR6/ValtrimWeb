// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  workspace: 'M3 5h18v4H3zm0 6h8v10H3zm10 0h8v10h-8z',
  results: 'M4 4h16v4H4zm0 6h10v4H4zm0 6h16v4H4z',
  viewer: 'M3 5h18v14H3zm4 3h10v8H7z',
  projects: 'M4 6h7l2 2h7v10H4z M4 6v12',
  estimating: 'M6 4h12v16H6z M9 8h6 M9 12h2 M13 12h2 M9 16h6',
  operations: 'M4 13h4v7H4z M10 9h4v11h-4z M16 5h4v15h-4z',
  system: 'M12 2l3 2.2 3.6-.7 1.5 3.3 3 2.1-1 3.5 1 3.5-3 2.1-1.5 3.3-3.6-.7L12 22l-3-2.2-3.6.7-1.5-3.3-3-2.1 1-3.5-1-3.5 3-2.1L5.4 3.5 9 4.2z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 5.66 1.41 1.41M4.64 4.64 6.05 6.05m10.9 0 1.41-1.41M4.64 19.36l1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  moon: 'M20.4 14.5A8.5 8.5 0 1 1 9.5 3.6 7 7 0 0 0 20.4 14.5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M3 20a6 6 0 0 1 12 0 M13 20a4 4 0 0 1 8 0',
  logout: 'M15 12H4 M9 7l-5 5 5 5 M20 4v16',
};

export default function Icon({ name, className = '', title }) {
  const path = ICON_PATHS[name] || ICON_PATHS.system;
  const classes = ['icon', className].filter(Boolean).join(' ');

  return (
    <svg
      viewBox="0 0 24 24"
      className={classes}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : 'presentation'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      <path d={path} />
    </svg>
  );
}
