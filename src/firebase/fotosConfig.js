
export const MODO_ALMACEN_FOTOS = 'firestore';

export const PRESUPUESTO_DOC_FOTOS = 850 * 1024; 

export const PERFILES_COMPRESION = {
  firestore: { maxWidth: 880, maxHeight: 880, quality: 0.62, formato: 'image/webp' },
  storage: { maxWidth: 1280, maxHeight: 1280, quality: 0.85, formato: 'image/webp' },
};

export function perfilActivo() {
  return PERFILES_COMPRESION[MODO_ALMACEN_FOTOS] || PERFILES_COMPRESION.firestore;
}

export const esModoStorage = () => MODO_ALMACEN_FOTOS === 'storage';

const CAMPOS_FOTO_ORDEN = ['fotosLados', 'fotosIngreso', 'fotosSalida'];

export function pesoFotosDe(datos = {}) {
  let peso = 0;
  for (const campo of CAMPOS_FOTO_ORDEN) {
    const valor = datos[campo];
    if (!valor) continue;
    if (Array.isArray(valor)) {
      peso += valor.reduce((s, v) => s + (typeof v === 'string' ? v.length : 0), 0);
    } else if (typeof valor === 'object') {
      peso += Object.values(valor).reduce(
        (s, v) => s + (typeof v === 'string' ? v.length : 0),
        0
      );
    }
  }
  return peso;
}

export function cabenFotosDe(datos = {}) {
  return pesoFotosDe(datos) <= PRESUPUESTO_DOC_FOTOS;
}
