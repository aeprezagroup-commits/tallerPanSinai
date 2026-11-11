// CONFIGURACIÓN DEL ALMACÉN DE FOTOS
//
// MODO_ACTUAL = 'firestore'
//   Las fotos se comprimen y se guardan DENTRO de Firestore.
//   • No requiere plan Blaze ni tarjeta.
//   • Techo: 1 GB gratis en Firestore y 1 MB por documento.
//
// MODO_ACTUAL = 'storage'
//   Las fotos se suben a Firebase Storage (diseñado para imágenes).
//   • Requiere plan Blaze (cuenta de facturación vinculada).
//   • Recomendado cuando la empresa sea dueña de su facturación
//     y la flota supere ~2.000 vehículos.
//
// >>> PARA MIGRAR A STORAGE SOLO HAY QUE CAMBIAR LA LÍNEA DE ABAJO.
//     El resto del sistema (compresión, reemplazo limpio, ciclo de
//     vida de vehículos, respaldo a GitHub) ya está preparado.

export const MODO_ALMACEN_FOTOS = 'firestore';

// Presupuesto de seguridad por documento de Firestore (el límite duro es 1 MB).
// Medido en vivo: una orden sin fotos pesa 1 KB y cada foto ~102 KB en el peor
// caso, así que 850 KB deja ~170 KB de colchón y garantiza 8 fotos por orden.
export const PRESUPUESTO_DOC_FOTOS = 850 * 1024; // 850 KB

// Perfiles de compresión, medidos con una foto pesada de 4,275 KB:
//   firestore 880/0.62 → 76 KB  (101 KB como base64)  → 4 fotos ≈ 400 KB
//   storage   1280/0.85 → 372 KB (calidad máxima, sin límite de documento)
export const PERFILES_COMPRESION = {
  firestore: { maxWidth: 880, maxHeight: 880, quality: 0.62, formato: 'image/webp' },
  storage: { maxWidth: 1280, maxHeight: 1280, quality: 0.85, formato: 'image/webp' },
};

export function perfilActivo() {
  return PERFILES_COMPRESION[MODO_ALMACEN_FOTOS] || PERFILES_COMPRESION.firestore;
}

export const esModoStorage = () => MODO_ALMACEN_FOTOS === 'storage';

// Campos de una orden que guardan fotos (son los que hacen crecer los documentos).
const CAMPOS_FOTO_ORDEN = ['fotosLados', 'fotosIngreso', 'fotosSalida'];

/**
 * Peso aproximado en bytes de todas las fotos que lleva un objeto de orden.
 * Solo cuenta las cadenas (los DataURL son texto, ~1.37× el tamaño real).
 */
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

/** ¿Caben las fotos de esta orden dentro del presupuesto por documento? */
export function cabenFotosDe(datos = {}) {
  return pesoFotosDe(datos) <= PRESUPUESTO_DOC_FOTOS;
}
