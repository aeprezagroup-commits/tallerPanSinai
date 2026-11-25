export function reintentarLogo(evento) {
  const img = evento.currentTarget;
  if (!img || img.dataset.reintento === '1') return;
  img.dataset.reintento = '1';
  const ruta = new URL(img.src, window.location.origin).pathname;
  img.src = `${ruta}?v=${Date.now()}`;
}
