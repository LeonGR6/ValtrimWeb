# Valtrim Web

Valtrim Web es la aplicacion frontend del proyecto Valtrim, construida con React + Vite.
Su objetivo es ofrecer la interfaz de usuario para autenticacion con Supabase y operacion diaria de la plataforma,
con soporte de internacionalizacion en espanol e ingles.

## Requisitos

- Node.js 22+
- npm

## Comandos

```bash
npm run dev
npm run build
npm run lint
```

## Nota

Este proyecto usa Supabase Auth para iniciar sesion, registrar usuarios y restaurar sesiones.
Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.
