// Versión de la aplicación, inyectada por Vite desde vite.config.js
// (__APP_VERSION__ = version de package.json).
// typeof se usa a propósito: si el símbolo no existe, no lanza ReferenceError.
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

// Texto para los pies de página: sólo la versión, sin fecha ni hash.
export const VERSION_TEXT = `v${VERSION}`;
