// Si la carga del logo falla (red inestable o servidor reiniciando),
// el <img> se queda en blanco: los navegadores no reintean solos.
// Este manejador reintenta una sola vez con buste de caché.
export function reintentarLogo(evento) {
  const img = evento.currentTarget;
  if (!img || img.dataset.reintento === '1') return;
  img.dataset.reintento = '1';
  const ruta = new URL(img.src, window.location.origin).pathname;
  img.src = `${ruta}?v=${Date.now()}`;
}
