// COMPRESIÓN DE IMÁGENES
// Convierte las fotos de cámara (varios MB) en archivos
// ligeros (~100-200 KB) en formato WebP, manteniendo una
// calidad nítida en pantalla y móvil. Objetivo: poder
// almacenar un volumen amplio en Firebase Storage.

import { perfilActivo } from '../firebase/fotosConfig';

// Perfil por defecto = modo Firestore (880 px / 0.62 → ~101 KB en base64).
// En modo Storage se pasa el perfil de máxima calidad (ver fotosConfig.js).
export const CONFIG_COMPRESION = perfilActivo();

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer el archivo de imagen'));
    };
    img.src = url;
  });
}

function canvasABlob(canvas, formato, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), formato, quality);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Comprime una imagen y devuelve un File listo para subir.
 * - Reduce la resolución solo si excede el máximo (nunca amplía).
 * - Prefiere WebP; si el navegador no lo soporta en canvas, usa JPEG.
 * - Si algo falla, devuelve el archivo original sin romper el flujo.
 *
 * @param {File|Blob} file
 * @param {{maxWidth?:number, maxHeight?:number, quality?:number, formato?:string}} opciones
 * @returns {Promise<File>}
 */
export async function comprimirImagen(file, opciones = {}) {
  const opts = { ...CONFIG_COMPRESION, ...opciones };

  if (!file) return file;
  if (!file.type || !file.type.startsWith('image/')) return file;
  // GIF animados y SVG: se suben tal cual para no perder contenido
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  try {
    const img = await cargarImagen(file);

    const escala = Math.min(1, opts.maxWidth / img.width, opts.maxHeight / img.height);
    const width = Math.max(1, Math.round(img.width * escala));
    const height = Math.max(1, Math.round(img.height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasABlob(canvas, opts.formato, opts.quality);
    let formato = opts.formato;

    // Respaldo: navegadores antiguos sin soporte de WebP en canvas
    if (!blob) {
      formato = 'image/jpeg';
      blob = await canvasABlob(canvas, formato, opts.quality);
    }
    if (!blob) return file;

    const extension = formato === 'image/webp' ? 'webp' : 'jpg';
    const nombreBase = String(file.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';

    return new File([blob], `${nombreBase}.${extension}`, {
      type: formato,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('No se pudo comprimir la imagen, se sube el original:', err);
    return file;
  }
}

export default comprimirImagen;
