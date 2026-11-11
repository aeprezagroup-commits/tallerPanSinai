import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './config';
import { comprimirImagen } from '../services/imageCompressionService';
import {
  MODO_ALMACEN_FOTOS, esModoStorage, perfilActivo, PRESUPUESTO_DOC_FOTOS,
} from './fotosConfig';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function aDataURLComprimida(file, comprimir, cupoPorFoto = PRESUPUESTO_DOC_FOTOS) {
  if (!comprimir) return await fileToDataUrl(file);

  const perfil = perfilActivo();
  let archivo = file;
  try {
    archivo = await comprimirImagen(file, perfil);
  } catch (e) {
    console.warn('Compresión omitida, se usa el archivo original:', e);
    archivo = file;
  }

  let dataUrl = await fileToDataUrl(archivo);

  if (dataUrl.length > cupoPorFoto) {
    const escalas = [0.75, 0.6];
    for (const escala of escalas) {
      if (dataUrl.length <= cupoPorFoto) break;
      try {
        const ajustado = await comprimirImagen(file, {
          ...perfil,
          maxWidth: Math.round(perfil.maxWidth * escala),
          maxHeight: Math.round(perfil.maxHeight * escala),
          quality: escala <= 0.6 ? 0.45 : 0.5,
        });
        const urlAjustada = await fileToDataUrl(ajustado);
        if (urlAjustada.length < dataUrl.length) dataUrl = urlAjustada;
      } catch (e) {
        console.warn('No se pudo reducir más la imagen:', e);
        break;
      }
    }
    console.warn(
      `Foto "${file.name}" pesa ${Math.round(dataUrl.length / 1024)} KB y su cupo es de ` +
      `${Math.round(cupoPorFoto / 1024)} KB. Se usó el perfil más ligero para no ` +
      'rebasar el documento en Firestore.'
    );
  }
  return dataUrl;
}

function rutaDesdeURL(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';
  try {
    const u = new URL(url);
    const inicio = u.pathname.indexOf('/o/');
    if (inicio < 0) return '';
    return decodeURIComponent(u.pathname.slice(inicio + 3));
  } catch (e) {
    return '';
  }
}

function extensionDe(file) {
  const nombre = String(file?.name || '');
  const ext = nombre.includes('.') ? nombre.split('.').pop() : '';
  return (ext || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
}

export async function subirFoto(file, clave, tipo = 'ingreso', opciones = {}) {
  const {
    urlAnterior = '',
    nombreFijo = false,
    comprimir = true,
    carpeta = 'ordenes',
  } = opciones;

  if (!file) throw new Error('No se recibió ningún archivo de imagen');

  const cupo = Math.round(
    carpeta === 'vehiculos' ? PRESUPUESTO_DOC_FOTOS / 4 : PRESUPUESTO_DOC_FOTOS / 8
  );

  if (!esModoStorage()) {
    return await aDataURLComprimida(file, comprimir, cupo);
  }

  if (!isFirebaseConfigured || !storage) {
    return await aDataURLComprimida(file, comprimir, cupo);
  }

  let archivo = file;
  if (comprimir) {
    try {
      archivo = await comprimirImagen(file, perfilActivo());
    } catch (e) {
      console.warn('Compresión omitida, se sube el archivo original:', e);
      archivo = file;
    }
  }

  const extension = extensionDe(archivo);
  const nombreArchivo = nombreFijo
    ? `${tipo}.${extension}`
    : `${Date.now()}.${extension}`;
  const ruta = `${carpeta}/${String(clave).trim()}/${nombreArchivo}`;
  const rutaNueva = nombreFijo
    ? `${carpeta}/${String(clave).trim()}/${tipo}.${extension}`
    : ruta;

  try {
    const storageRef = ref(storage, ruta);
    await uploadBytes(storageRef, archivo, { contentType: archivo.type || 'image/webp' });
    const downloadURL = await getDownloadURL(storageRef);

    if (urlAnterior && urlAnterior.startsWith('http')) {
      const rutaVieja = rutaDesdeURL(urlAnterior);
      if (!rutaVieja || rutaVieja !== rutaNueva) {
        await eliminarFoto(urlAnterior);
      }
    }

    return downloadURL;
  } catch (error) {
    console.error('Error al subir foto a Firebase Storage:', error);
    throw new Error(
      'No se pudo subir la foto a Firebase Storage. ' +
      'Revisa que el proyecto tenga Storage habilitado (plan Blaze) y sus reglas desplegadas.'
    );
  }
}

export async function subirMultiplesFotos(files, ordenId, tipo = 'ingreso', opciones = {}) {
  const urls = [];
  const fallidas = [];

  for (const file of files) {
    try {
      const url = await subirFoto(file, ordenId, tipo, {
        ...opciones,
        urlAnterior: '',
        nombreFijo: false,
      });
      urls.push(url);
    } catch (err) {
      console.error('Fallo al subir foto:', file?.name, err);
      fallidas.push(file?.name || 'foto');
    }
  }

  if (fallidas.length > 0) {
    throw new Error(
      `${fallidas.length} foto(s) no se pudieron subir a Storage: ${fallidas.join(', ')}`
    );
  }
  return urls;
}

export async function eliminarFoto(url) {
  if (!esModoStorage()) return false; 
  if (!isFirebaseConfigured || !storage) return false;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return true; 
    console.warn('No se pudo eliminar la foto de Storage:', error);
    return false;
  }
}

export async function eliminarCarpeta(ruta) {
  if (!esModoStorage()) return 0;
  if (!isFirebaseConfigured || !storage) return 0;
  if (!ruta) return 0;

  try {
    const listRef = ref(storage, ruta);
    const res = await listAll(listRef);
    let borrados = 0;

    for (const item of res.items) {
      try {
        await deleteObject(item);
        borrados += 1;
      } catch (e) {
        if (e?.code !== 'storage/object-not-found') {
          console.warn('No se pudo eliminar', item.fullPath, e);
        }
      }
    }

    for (const prefijo of res.prefixes) {
      borrados += await eliminarCarpeta(prefijo.fullPath);
    }

    return borrados;
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return 0;
    console.warn('No se pudo recorrer la carpeta de Storage:', error);
    return 0;
  }
}
