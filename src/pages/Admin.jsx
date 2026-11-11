import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useRef } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { Link } from 'react-router-dom';
import {
  TbTruck,
  TbDownload,
  TbUpload,
  TbPlus,
  TbTrash,
  TbPencil,
  TbCheck,
  TbX,
  TbSearch,
  TbPrinter,
  TbPhone,
  TbMapPin,
  TbAlertCircle,
  TbRefresh,
  TbLock,
  TbCamera,
} from '../icons';
import {
  obtenerPersonalVisible, agregarUsuario, eliminarUsuario, alternarEstadoUsuario,
  actualizarUsuario, reiniciarPassword, zonaTexto, PASSWORD_GENERICA
} from '../services/usuariosService';
import {
  obtenerFlotaVehiculos, registrarVehiculoCatalogo, eliminarVehiculoCatalogo,
  generarPlantillaCSV, importarVehiculosCSV,
  RUTAS_PREDETERMINADAS, DEPARTAMENTOS_EL_SALVADOR, centroCostoPorDepartamento,
  obtenerRutasPorDepartamento, ANIOS_VEHICULO, opcionesCatalogo
} from '../services/vehiculosService';
import { CENTROS_COSTO } from '../services/gastosService';
import { eliminarFotosVehiculo, mapaEstadoFotos } from '../services/fotosVehiculoService';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { validarPassword } from '../utils/passwords';
import ModalPortal from '../components/ModalPortal';
import ResumenErrores from '../components/ResumenErrores';
import IconoMascara from '../components/IconoMascara';

// Módulos del área de administración: /admin/personal y /admin/vehiculos
export default function Admin({ seccion = 'personal' }) {
  const esPersonal = seccion !== 'vehiculos';
  // La cuenta de soporte (superadmin) queda fuera de este listado
  const [usuarios, setUsuarios] = useState(obtenerPersonalVisible);
  const [flota, setFlota] = useState(obtenerFlotaVehiculos);
  const [busquedaVehiculo, setBusquedaVehiculo] = useState('');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [qrModalVehiculo, setQrModalVehiculo] = useState(null);
  const fileInputRef = useRef(null);
  const { addToast, confirm } = useToast();
  const { currentUser } = useAuth();

  // Contraseña temporal recién generada: se muestra UNA sola vez al
  // administrador para que se la entregue en mano a la persona.
  const [reinicioPassword, setReinicioPassword] = useState(null);

  // Estados de errores de validación de formulario
  const [erroresUsuario, setErroresUsuario] = useState({});
  const [erroresVehiculo, setErroresVehiculo] = useState({});

  // Estados formulario nuevo usuario (también usado para editar: usuarioEditando)
  const FORM_USUARIO_VACIO = {
    nombre: '',
    password: '',
    rol: 'mecanico',
    cargo: '',
    telefono: '',
    departamento: '',
    rutas: []
  };
  const [nuevoUsuario, setNuevoUsuario] = useState(FORM_USUARIO_VACIO);
  // Si se está editando un usuario existente, guarda su id
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // Los formularios de alta (usuario y vehículo) permanecen ocultos hasta
  // que se pida registrar algo nuevo: la pantalla abre con las listas.
  const [verFormUsuario, setVerFormUsuario] = useState(false);
  const [verFormVehiculo, setVerFormVehiculo] = useState(false);

  // Estados formulario nuevo vehículo
  const [nuevoVehiculo, setNuevoVehiculo] = useState({
    placa: '',
    marca: '',
    modelo: '',
    numMotor: '',
    vin: '',
    anio: '',
    tipo: 'Camión de Reparto',
    conductorHabitual: '',
    departamento: '',
    ruta: '',
    observaciones: ''
  });

  // Modal de asignación: ruta / ubicación / centro de costo de una unidad
  const [asignacionVehiculo, setAsignacionVehiculo] = useState(null);

  const cargarDatos = () => {
    setUsuarios(obtenerPersonalVisible());
    setFlota(obtenerFlotaVehiculos());
  };

  // Estado fotográfico por placa: las fotos se completan cuando la unidad
  // ingresa al taller, así que faltar no es una alerta.
  const [fotosEstado, setFotosEstado] = useState({});

  const cargarEstadoFotos = async () => {
    try {
      const mapa = await mapaEstadoFotos();
      setFotosEstado(mapa || {});
    } catch (err) {
      console.warn('No se pudo cargar el estado fotográfico:', err);
    }
  };

  useEffect(() => {
    if (!esPersonal) cargarEstadoFotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion]);

  useEffect(() => {
    const handleUsersUpdate = () => setUsuarios(obtenerPersonalVisible());
    const handleVehiclesUpdate = () => setFlota(obtenerFlotaVehiculos());

    window.addEventListener('pan_sinai_users_updated', handleUsersUpdate);
    window.addEventListener('pan_sinai_vehicles_updated', handleVehiclesUpdate);

    return () => {
      window.removeEventListener('pan_sinai_users_updated', handleUsersUpdate);
      window.removeEventListener('pan_sinai_vehicles_updated', handleVehiclesUpdate);
    };
  }, []);

  // ---- USUARIOS / MECÁNICOS ----
  // Alterna una ruta en la zona del formulario (toggle)
  const toggleRuta = (ruta) => {
    setNuevoUsuario(prev => {
      const rutas = Array.isArray(prev.rutas) ? prev.rutas : [];
      return {
        ...prev,
        rutas: rutas.includes(ruta) ? rutas.filter(r => r !== ruta) : [...rutas, ruta]
      };
    });
  };

  // Carga un usuario existente en el formulario para editar su zona/datos
  const handleEditarUsuario = (u) => {
    setUsuarioEditando(u.id);
    setNuevoUsuario({
      nombre: u.nombre || '',
      // La contraseña NUNCA se carga en el formulario: no se puede ver ni
      // queda expuesta en el navegador. Vacío = conservar la actual.
      password: '',
      rol: u.rol || 'mecanico',
      cargo: u.cargo || '',
      telefono: u.telefono || '',
      departamento: u.departamento || '',
      rutas: Array.isArray(u.rutas) ? u.rutas : []
    });
    // Lleva el foco al formulario (arriba de la página)
    setVerFormUsuario(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelarEdicion = () => {
    setUsuarioEditando(null);
    setNuevoUsuario(FORM_USUARIO_VACIO);
    setVerFormUsuario(false);
  };

  // Abre o cierra el formulario de alta desde el botón del encabezado.
  // Al abrir, arranca en blanco (si había una edición en curso se descarta).
  const alternarFormularioNuevo = () => {
    if (!esPersonal) {
      setVerFormVehiculo(v => !v);
      return;
    }
    const abierto = verFormUsuario || Boolean(usuarioEditando);
    handleCancelarEdicion();
    setVerFormUsuario(!abierto);
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    const errores = {};
    const nombre = (nuevoUsuario.nombre || '').trim();
    const password = (nuevoUsuario.password || '').trim();

    if (!nombre || nombre.length < 3) {
      errores.nombre = 'El nombre completo es obligatorio y debe tener al menos 3 caracteres.';
    } else if (!usuarioEditando && usuarios.some(u => u.nombre?.trim().toLowerCase() === nombre.toLowerCase())) {
      errores.nombre = 'Ya existe un usuario o técnico registrado con este nombre.';
    }

    // Al EDITAR, si ingresa contraseña se valida. Al crear, se asigna la genérica automática.
    const cambiaPassword = usuarioEditando && password.length > 0;
    if (cambiaPassword) {
      const errorPassword = validarPassword(password);
      if (errorPassword) errores.password = errorPassword;
    }

    if (Object.keys(errores).length > 0) {
      setErroresUsuario(errores);
      addToast('Revisa los campos señalados antes de guardar el usuario.', 'error');
      return;
    }
    setErroresUsuario({});

    // Toda escritura en la base compartida se anuncia antes de ejecutarse.
    const confirmado = await confirm({
      title: usuarioEditando ? '¿Guardar cambios del usuario?' : '¿Crear un usuario nuevo?',
      message: usuarioEditando
        ? `Se actualizarán los datos de "${nombre}" en el sistema.`
        : `Se registrará a "${nombre}" con la contraseña genérica (${PASSWORD_GENERICA}). Podrá iniciar sesión de inmediato y se le pedirá cambiarla.`,
      confirmText: usuarioEditando ? 'Sí, guardar cambios' : 'Sí, crear usuario',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmado) return;

    try {
      if (usuarioEditando) {
        const cambios = { ...nuevoUsuario, nombre };
        // Sin contraseña nueva no se toca la que ya tiene.
        if (!password) delete cambios.password;
        actualizarUsuario(usuarioEditando, cambios);
        addToast(`Datos de "${nombre}" actualizados correctamente`, 'success');
      } else {
        agregarUsuario({
          ...nuevoUsuario,
          nombre,
          password: PASSWORD_GENERICA
        });
        addToast(`Personal "${nombre}" registrado con éxito. Se asignó la contraseña genérica (${PASSWORD_GENERICA}) y se le solicitará cambiarla al ingresar.`, 'success', 6000);
      }
      setUsuarioEditando(null);
      setNuevoUsuario(FORM_USUARIO_VACIO);
      setVerFormUsuario(false);
      cargarDatos();
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      addToast(err.message || 'Error al guardar usuario', 'error');
    }
  };

  const handleEliminarUsuario = async (id, nombre) => {
    const confirmado = await confirm({
      title: '¿Eliminar personal del taller?',
      message: `¿Estás seguro de que deseas eliminar permanentemente a "${nombre}"? Esta acción removerá sus credenciales de acceso al sistema.`,
      confirmText: 'Sí, eliminar personal',
      cancelText: 'Cancelar',
      danger: true
    });
    if (confirmado) {
      eliminarUsuario(id);
      addToast(`Personal "${nombre}" eliminado del sistema`, 'info');
      cargarDatos();
    }
  };

  const handleToggleEstado = async (u) => {
    const activar = u.activo === false;
    const confirmado = await confirm({
      title: activar ? '¿Activar usuario?' : '¿Inactivar usuario?',
      message: activar
        ? `"${u.nombre}" podrá volver a iniciar sesión en el sistema.`
        : `"${u.nombre}" dejará de poder iniciar sesión hasta que lo actives de nuevo.`,
      confirmText: activar ? 'Sí, activar' : 'Sí, inactivar',
      cancelText: 'Cancelar',
      danger: !activar
    });
    if (!confirmado) return;

    alternarEstadoUsuario(u.id);
    addToast(activar ? `Usuario "${u.nombre}" activado` : `Usuario "${u.nombre}" inactivado`, 'info');
    cargarDatos();
  };

  /**
   * Reinicia la contraseña de una persona: genera una temporal y deja la
   * cuenta marcada para que el sistema le obligue a cambiarla al ingresar.
   * La temporal se muestra una sola vez; no se guarda en ningún historial.
   */
  const handleReiniciarPassword = async (u) => {
    const confirmado = await confirm({
      title: '¿Reiniciar la contraseña?',
      message: `Se generará una contraseña temporal para "${u.nombre}". Su contraseña actual dejará de funcionar de inmediato y, al ingresar, el sistema le exigirá crear una nueva.`,
      confirmText: 'Sí, reiniciar',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!confirmado) return;

    try {
      const { temporal } = reiniciarPassword(u.id, {
        por: currentUser?.nombre || 'Administración'
      });
      setReinicioPassword({ usuario: u, temporal });
      cargarDatos();
      addToast(`Contraseña de "${u.nombre}" reiniciada`, 'success');
    } catch (err) {
      console.error('Error al reiniciar contraseña:', err);
      addToast(err.message || 'No se pudo reiniciar la contraseña', 'error');
    }
  };

  const copiarPasswordTemporal = async () => {
    if (!reinicioPassword?.temporal) return;
    try {
      await navigator.clipboard.writeText(reinicioPassword.temporal);
      addToast('Contraseña temporal copiada', 'success');
    } catch {
      addToast('No se pudo copiar. Selecciona el texto y cópialo manualmente.', 'warning');
    }
  };

  // ---- FLOTA / VEHÍCULOS ----
  const handleCrearVehiculo = async (e) => {
    e.preventDefault();
    const errores = {};
    const placa = normalizarPlaca(nuevoVehiculo.placa);
    const marca = (nuevoVehiculo.marca || '').trim();
    const modelo = (nuevoVehiculo.modelo || '').trim();
    const anio = String(nuevoVehiculo.anio || '').trim();
    const vin = (nuevoVehiculo.vin || '').trim().toUpperCase();

    if (!placa || placa.length < 3) {
      errores.placa = 'La placa es obligatoria (mínimo 3 caracteres alfanuméricos).';
    }
    if (!marca || marca.length < 2) {
      errores.marca = 'La marca del vehículo es obligatoria.';
    }
    if (!modelo) {
      errores.modelo = 'El modelo del vehículo es obligatorio.';
    }
    if (anio) {
      const anioNum = parseInt(anio, 10);
      const anioMax = new Date().getFullYear() + 1;
      if (isNaN(anioNum) || anioNum < 1970 || anioNum > anioMax) {
        errores.anio = `Año inválido (debe ser un año entre 1970 y ${anioMax}).`;
      }
    }
    if (vin && vin.length > 17) {
      errores.vin = 'El VIN no puede superar los 17 caracteres.';
    }

    if (Object.keys(errores).length > 0) {
      setErroresVehiculo(errores);
      addToast('No se puede registrar el vehículo con datos faltantes. Revisa los campos marcados.', 'error');
      return;
    }
    setErroresVehiculo({});

    // Verificación de duplicado en flota activa
    const yaExiste = flota.some(v => normalizarPlaca(v.placa) === placa);
    if (yaExiste) {
      const confirmarActualizacion = await confirm({
        title: 'Vehículo ya existente en flota',
        message: `El vehículo con placa "${placa}" ya se encuentra registrado en el catálogo. ¿Deseas actualizar su información técnica con estos datos?`,
        confirmText: 'Actualizar vehículo',
        cancelText: 'Cancelar',
        danger: false
      });
      if (!confirmarActualizacion) return;
    } else {
      // Alta nueva: se anuncia el registro antes de escribir en la flota.
      const confirmado = await confirm({
        title: '¿Registrar vehículo en la flota?',
        message: `Se dará de alta la placa "${placa}" (${marca} ${modelo}) en el catálogo del taller.`,
        confirmText: 'Sí, registrar vehículo',
        cancelText: 'Cancelar',
        danger: false
      });
      if (!confirmado) return;
    }

    try {
      registrarVehiculoCatalogo({
        ...nuevoVehiculo,
        placa,
        marca,
        modelo,
        vin,
        anio,
        centroCosto: centroCostoPorDepartamento(nuevoVehiculo.departamento)
      });
      addToast(`Vehículo ${placa} (${marca} ${modelo}) registrado exitosamente en la flota`, 'success');
      setNuevoVehiculo({
        placa: '',
        marca: '',
        modelo: '',
        numMotor: '',
        vin: '',
        anio: '',
        tipo: 'Camión de Reparto',
        conductorHabitual: '',
        departamento: '',
        ruta: '',
        observaciones: ''
      });
      setVerFormVehiculo(false);
      cargarDatos();
      cargarEstadoFotos();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Error al registrar el vehículo', 'error');
    }
  };

  // Guarda la nueva asignación de una unidad (reubicación en el país)
  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    if (!asignacionVehiculo) return;

    const confirmado = await confirm({
      title: '¿Guardar asignación de la unidad?',
      message: `La placa "${asignacionVehiculo.placa}" quedará asignada a ${asignacionVehiculo.ruta || 'sin ruta definida'}.`,
      confirmText: 'Sí, guardar asignación',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmado) return;

    try {
      registrarVehiculoCatalogo({
        ...asignacionVehiculo,
        departamento: asignacionVehiculo.departamento || '',
        ruta: asignacionVehiculo.ruta || '',
        centroCosto: (asignacionVehiculo.centroCosto || '').trim().toUpperCase()
          || centroCostoPorDepartamento(asignacionVehiculo.departamento)
      });
      addToast(`Asignación actualizada: ${asignacionVehiculo.placa} → ${asignacionVehiculo.ruta || 'Sin ruta'} (${centroCostoPorDepartamento(asignacionVehiculo.departamento) || 'S/CENTRO'})`, 'success');
      setAsignacionVehiculo(null);
      cargarDatos();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Error al guardar la asignación', 'error');
    }
  };

  const handleEliminarVehiculo = async (placa) => {
    const confirmado = await confirm({
      title: '¿Dar de baja unidad de flota?',
      message: `¿Dar de baja el vehículo con placa "${placa}" del inventario activo? ` +
        'Se retirará del catálogo de flota operacional y SE ELIMINARÁN TODAS SUS FOTOS: ' +
        'las 4 de estado y las guardadas en sus órdenes (ingreso y salida), para liberar espacio. ' +
        'Esta acción no se puede deshacer.',
      confirmText: 'Sí, dar de baja',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!confirmado) return;

    eliminarVehiculoCatalogo(placa);

    // Ciclo de vida: el camión dado de baja pierde sus fotos
    try {
      const res = await eliminarFotosVehiculo(placa);
      const mb = res.bytesLiberados > 0
        ? ` y se liberaron ~${(res.bytesLiberados / 1048576).toFixed(2)} MB de sus ${res.ordenesLimpiadas} orden(es)`
        : '';
      addToast(
        `Vehículo ${placa} dado de baja. Se eliminaron ${res.archivosBorrados} archivo(s)${mb}.`,
        'info',
        7000
      );
    } catch (err) {
      console.error(err);
      addToast(
        `Vehículo ${placa} dado de baja, pero no se pudieron eliminar todas sus fotos: ${err.message}`,
        'warning',
        7000
      );
    }
    cargarDatos();
    cargarEstadoFotos();
  };

  // ---- DESCARGA Y SUBIDA CSV ----
  const handleDescargarPlantilla = () => {
    const csvContent = '\uFEFF' + generarPlantillaCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_vehiculos_pan_sinai.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Plantilla CSV descargada con formato seguro (UTF-8 con BOM)', 'success');
  };

  const handleSubirArchivoCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmado = await confirm({
      title: '¿Importar archivo de vehículos?',
      message: `Se leerá "${file.name}" y se darán de alta las filas válidas en el catálogo. Los registros incompletos se omitirán por seguridad.`,
      confirmText: 'Sí, importar archivo',
      cancelText: 'Cancelar',
      danger: false
    });
    // Se libera el input en ambos caminos para poder volver a elegir el archivo.
    e.target.value = '';
    if (!confirmado) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const texto = event.target.result;
        const res = importarVehiculosCSV(texto);
        if (res.omitidos > 0) {
          addToast(`Se importaron ${res.total} vehículos. Se omitieron ${res.omitidos} registros incompletos por seguridad.`, 'warning', 6500);
        } else {
          addToast(`¡Éxito! Se importaron ${res.total} vehículos completos a la base de Pan Sinaí`, 'success');
        }
        cargarDatos();
      } catch (err) {
        addToast(`Error al procesar CSV: ${err.message}`, 'error', 6500);
      }
    };
    reader.readAsText(file);
  };

  const flotaFiltrada = flota.filter(v =>
    !busquedaVehiculo ||
    v.placa.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
    v.marca.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
    v.modelo.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
    v.conductorHabitual?.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
    v.ruta?.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
    v.departamento?.toLowerCase().includes(busquedaVehiculo.toLowerCase())
  );

  // Personal filtrado por nombre, cargo, rol, teléfono o zona
  const qUsuario = busquedaUsuario.trim().toLowerCase();
  const usuariosFiltrados = usuarios.filter(u =>
    !qUsuario ||
    (u.nombre || '').toLowerCase().includes(qUsuario) ||
    (u.cargo || '').toLowerCase().includes(qUsuario) ||
    (u.rol || '').toLowerCase().includes(qUsuario) ||
    (u.telefono || '').toLowerCase().includes(qUsuario) ||
    zonaTexto(u).toLowerCase().includes(qUsuario)
  );

  // Estado real del formulario de alta (sirve para el botón del encabezado)
  const formularioAbierto = esPersonal ? verFormUsuario || Boolean(usuarioEditando) : verFormVehiculo;

  return (
    <div className="animate-fade-in">
      {/* Encabezado del módulo activo */}
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}
      >
        <div>
          <BotonVolver a="/admin" etiqueta="Volver al Panel" />
          <h1>{esPersonal ? 'Personal y Accesos' : 'Vehículos y Flota'}</h1>
          <p>
            {esPersonal
              ? `Usuarios, roles y accesos (${usuarios.length} registrados)`
              : `Flota, códigos QR y carga masiva (${flota.length} unidades)`}
          </p>
        </div>

        <button
          type="button"
          className={`btn ${formularioAbierto ? 'btn-secondary' : 'btn-primary'}`}
          onClick={alternarFormularioNuevo}
          style={{ flexShrink: 0 }}
        >
          {formularioAbierto ? <TbX /> : <TbPlus />}
          {formularioAbierto ? 'Cerrar' : esPersonal ? 'Nuevo Usuario' : 'Nuevo Vehículo'}
        </button>
      </div>

      {/* MÓDULO: GESTIÓN DE MECÁNICOS Y PERSONAL */}
      {esPersonal && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
          {/* Formulario nuevo usuario — a la vista solo cuando se pide dar de alta */}
          {(verFormUsuario || usuarioEditando) && (
          <div className="card">
            <div className="form-section-title" style={{ marginTop: 0 }}>
              <IconoMascara className="icon" src="/iconos/personal-taller.png" size={16} />
              {usuarioEditando ? 'Editar Personal / Zona de Operación' : 'Agregar Nuevo Mecánico / Usuario'}
            </div>

            <ResumenErrores errores={erroresUsuario} />

            <form onSubmit={handleCrearUsuario} noValidate>
              <div className="form-group" style={{ marginBottom: 9 }}>
                <label className="form-label">
                  Nombre Completo <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${erroresUsuario.nombre ? 'is-invalid' : ''}`}
                  placeholder="Nombre y apellido"
                  value={nuevoUsuario.nombre}
                  onChange={e => {
                    setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value });
                    if (erroresUsuario.nombre) setErroresUsuario({ ...erroresUsuario, nombre: null });
                  }}
                />
                {erroresUsuario.nombre && (
                  <span className="field-error"><TbAlertCircle size={13} /> {erroresUsuario.nombre}</span>
                )}
              </div>

              {usuarioEditando ? (
                <div className="form-group" style={{ marginBottom: 9 }}>
                  <label className="form-label">
                    Contraseña de Acceso (Opcional)
                  </label>
                  <input
                    type="password"
                    className={`form-input ${erroresUsuario.password ? 'is-invalid' : ''}`}
                    placeholder="Dejar vacío para conservar la actual"
                    value={nuevoUsuario.password}
                    onChange={e => {
                      setNuevoUsuario({ ...nuevoUsuario, password: e.target.value });
                      if (erroresUsuario.password) setErroresUsuario({ ...erroresUsuario, password: null });
                    }}
                    autoComplete="new-password"
                  />
                  {erroresUsuario.password ? (
                    <span className="field-error"><TbAlertCircle size={13} /> {erroresUsuario.password}</span>
                  ) : (
                    <small style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                      Dejar en blanco para mantener la contraseña actual.
                    </small>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(134,153,46,0.08)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 12,
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <TbLock style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={16} />
                  <span>
                    Contraseña temporal asignada: <strong style={{ fontFamily: 'var(--font-mono)' }}>{PASSWORD_GENERICA}</strong>. Al iniciar sesión por primera vez, el sistema obligará al usuario a crear su propia contraseña confidencial.
                  </span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 9 }}>
                <label className="form-label">Rol en el Sistema *</label>
                <select
                  className="form-select"
                  value={nuevoUsuario.rol}
                  onChange={e => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                >
                  <option value="mecanico">Mecánico / Técnico</option>
                  <option value="encargado">Encargado de Taller</option>
                  <option value="admin">Administrador General</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 9 }}>
                <label className="form-label">Cargo o Especialidad</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Especialidad técnica o cargo"
                  value={nuevoUsuario.cargo}
                  onChange={e => setNuevoUsuario({ ...nuevoUsuario, cargo: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 9 }}>
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={15}
                  className="form-input"
                  placeholder="Solo dígitos (ej. 71234567)"
                  value={nuevoUsuario.telefono}
                  onChange={e => setNuevoUsuario({
                    ...nuevoUsuario,
                    // Restricción de entrada: únicamente números.
                    telefono: e.target.value.replace(/\D/g, '').slice(0, 15)
                  })}
                />
              </div>

              {/* ---- ZONA DE OPERACIÓN (filtra los vehículos/órdenes que verá) ---- */}
              <div className="form-group" style={{ marginBottom: 9 }}>
                <label className="form-label">Zona: Departamento</label>
                <select
                  className="form-select"
                  value={nuevoUsuario.departamento}
                  onChange={e => setNuevoUsuario({ ...nuevoUsuario, departamento: e.target.value })}
                >
                  <option value="">— Sin departamento (no filtra por depto.) —</option>
                  {DEPARTAMENTOS_EL_SALVADOR.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Filtra el alcance territorial asignado al usuario.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Zona: Rutas de Distribución {nuevoUsuario.departamento && `(${nuevoUsuario.departamento})`}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {obtenerRutasPorDepartamento(nuevoUsuario.departamento).map(r => {
                    const activa = (nuevoUsuario.rutas || []).includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRuta(r)}
                        style={{
                          padding: '6px 10px',
                          fontSize: 11.5,
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          border: `1px solid ${activa ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: activa ? 'var(--color-accent-light)' : 'var(--color-bg-input)',
                          color: activa ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          fontWeight: activa ? 700 : 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {activa && <TbCheck size={13} style={{ flexShrink: 0 }} />}
                        {r}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {nuevoUsuario.departamento
                    ? `Mostrando las rutas asignadas a ${nuevoUsuario.departamento}.`
                    : 'Seleccione un departamento para filtrar las rutas específicas o asigne rutas generales.'}
                </span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {usuarioEditando ? <TbCheck /> : <TbPlus />}
                {usuarioEditando ? 'Guardar Cambios' : 'Registrar Personal'}
              </button>
              {usuarioEditando && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleCancelarEdicion}
                >
                  <TbX /> Cancelar Edición
                </button>
              )}
            </form>
          </div>
          )}

          {/* Lista de mecánicos y personal */}
          <div className="card">
            <div className="form-section-title" style={{ marginTop: 0 }}>
              <IconoMascara className="icon" src="/iconos/registro.png" size={16} /> Personal Registrado en Pan Sinaí ({usuariosFiltrados.length})
            </div>

            <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
              <TbSearch className="search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por nombre, cargo, rol o zona..."
                value={busquedaUsuario}
                onChange={e => setBusquedaUsuario(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
              {usuariosFiltrados.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '10px 2px' }}>
                  Sin coincidencias para «{busquedaUsuario.trim()}».
                </div>
              )}
              {usuariosFiltrados.map(u => (
                <div
                  key={u.id}
                  className="user-item-card"
                  style={{
                    opacity: u.activo === false ? 0.55 : 1
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                        {u.nombre}
                      </strong>
                      <span className={`badge ${u.rol === 'admin' ? 'badge-role-admin' : u.rol === 'mecanico' ? 'badge-role-mecanico' : 'badge-role-default'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {u.rol.toUpperCase()}
                      </span>
                      {u.debeCambiarPassword && (
                        <span
                          className="badge badge-pausado"
                          style={{ fontSize: 9.5, padding: '2px 7px' }}
                          title="Se le reinició la contraseña: al ingresar deberá crear una nueva."
                        >
                          CAMBIO PENDIENTE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, fontWeight: 500 }}>
                      {u.cargo || 'Sin especialidad'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 3, fontWeight: 600 }}>
                      <TbMapPin style={{ marginRight: 3, verticalAlign: -1 }} />Zona: {zonaTexto(u)}
                      {Array.isArray(u.rutas) && u.rutas.length > 0 && (
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                          {' '}({u.rutas.length} ruta{u.rutas.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    {u.telefono && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        <TbPhone style={{ marginRight: 4, verticalAlign: -1 }} /> {u.telefono}
                      </div>
                    )}
                  </div>

                  <div className="btn-group" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-card-action"
                      disabled={u.activo === false}
                      onClick={() => handleReiniciarPassword(u)}
                      title={u.activo === false ? 'Usuario inactivo: reactívalo para poder gestionarlo' : 'Generar una contraseña temporal y exigir el cambio al ingresar'}
                    >
                      <TbRefresh size={13} /> Reiniciar
                    </button>
                    <button
                      type="button"
                      className="btn-card-action"
                      disabled={u.activo === false}
                      onClick={() => handleEditarUsuario(u)}
                      title={u.activo === false ? 'Usuario inactivo: reactívalo para poder gestionarlo' : 'Editar datos y zona'}
                    >
                      <TbPencil size={13} /> Editar
                    </button>
                    <button
                      type="button"
                      className={`btn-card-action ${u.activo === false ? 'btn-success' : ''}`}
                      onClick={() => handleToggleEstado(u)}
                      title={u.activo === false ? 'Activar usuario' : 'Inactivar usuario'}
                    >
                      {u.activo === false ? 'Activar' : 'Inactivar'}
                    </button>
                    {u.id !== 'user-admin' && (
                      <button
                        type="button"
                        className="btn-card-action btn-card-danger"
                        disabled={u.activo === false}
                        onClick={() => handleEliminarUsuario(u.id, u.nombre)}
                        title={u.activo === false ? 'Usuario inactivo: reactívalo para poder gestionarlo' : 'Eliminar usuario del sistema'}
                      >
                        <TbTrash size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO: BASE DE VEHÍCULOS Y PLANTILLA */}
      {!esPersonal && (
        <div>
          {/* Barra de Acciones de Plantilla Masiva */}
          <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(249,115,22,0.08), var(--color-bg-card))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>Carga Masiva con Plantilla CSV / Excel</h3>
              </div>

              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDescargarPlantilla}
                >
                  <TbDownload /> Descargar Plantilla CSV
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleSubirArchivoCSV}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <TbUpload /> Importar CSV de Flota
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
            {/* Formulario para agregar vehículo individual — a la vista solo al dar de alta */}
            {verFormVehiculo && (
            <div className="card">
              <div className="form-section-title" style={{ marginTop: 0 }}>
                <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Registrar Vehículo en Flota
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                Registro individual de nueva unidad en el inventario.
              </p>

              <ResumenErrores errores={erroresVehiculo} />

              <form onSubmit={handleCrearVehiculo} noValidate>
                <div className="form-grid" style={{ gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Placa <span className="label-required">*</span></label>
                    <input
                      type="text"
                      className={`form-input ${erroresVehiculo.placa ? 'is-invalid' : ''}`}
                      placeholder="Número de placa"
                      style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                      value={nuevoVehiculo.placa}
                      onChange={e => {
                        setNuevoVehiculo({ ...nuevoVehiculo, placa: e.target.value });
                        if (erroresVehiculo.placa) setErroresVehiculo({ ...erroresVehiculo, placa: null });
                      }}
                    />
                    {erroresVehiculo.placa && (
                      <span className="field-error"><TbAlertCircle size={13} /> {erroresVehiculo.placa}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marca <span className="label-required">*</span></label>
                    <input
                      type="text"
                      className={`form-input ${erroresVehiculo.marca ? 'is-invalid' : ''}`}
                      placeholder="Marca del fabricante"
                      value={nuevoVehiculo.marca}
                      onChange={e => {
                        setNuevoVehiculo({ ...nuevoVehiculo, marca: e.target.value });
                        if (erroresVehiculo.marca) setErroresVehiculo({ ...erroresVehiculo, marca: null });
                      }}
                    />
                    {erroresVehiculo.marca && (
                      <span className="field-error"><TbAlertCircle size={13} /> {erroresVehiculo.marca}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Modelo <span className="label-required">*</span></label>
                    <input
                      type="text"
                      className={`form-input ${erroresVehiculo.modelo ? 'is-invalid' : ''}`}
                      placeholder="Modelo de la unidad"
                      value={nuevoVehiculo.modelo}
                      onChange={e => {
                        setNuevoVehiculo({ ...nuevoVehiculo, modelo: e.target.value });
                        if (erroresVehiculo.modelo) setErroresVehiculo({ ...erroresVehiculo, modelo: null });
                      }}
                    />
                    {erroresVehiculo.modelo && (
                      <span className="field-error"><TbAlertCircle size={13} /> {erroresVehiculo.modelo}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Motor</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Número de motor"
                      value={nuevoVehiculo.numMotor}
                      onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, numMotor: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Número VIN</label>
                    <input
                      type="text"
                      className={`form-input ${erroresVehiculo.vin ? 'is-invalid' : ''}`}
                      maxLength={17}
                      placeholder="Número de chasis / VIN (17 dígitos)"
                      style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 13 }}
                      value={nuevoVehiculo.vin}
                      onChange={e => {
                        setNuevoVehiculo({ ...nuevoVehiculo, vin: e.target.value });
                        if (erroresVehiculo.vin) setErroresVehiculo({ ...erroresVehiculo, vin: null });
                      }}
                    />
                    {erroresVehiculo.vin && (
                      <span className="field-error"><TbAlertCircle size={13} /> {erroresVehiculo.vin}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Año</label>
                    <select
                      className={`form-input ${erroresVehiculo.anio ? 'is-invalid' : ''}`}
                      value={nuevoVehiculo.anio || ''}
                      onChange={e => {
                        setNuevoVehiculo({ ...nuevoVehiculo, anio: e.target.value });
                        if (erroresVehiculo.anio) setErroresVehiculo({ ...erroresVehiculo, anio: null });
                      }}
                    >
                      <option value="">— Seleccione el año —</option>
                      {opcionesCatalogo(ANIOS_VEHICULO, nuevoVehiculo.anio).map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    {erroresVehiculo.anio && (
                      <span className="field-error"><TbAlertCircle size={13} /> {erroresVehiculo.anio}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conductor Habitual</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nombre del motorista asignado"
                      value={nuevoVehiculo.conductorHabitual}
                      onChange={e => setNuevoVehiculo({
                        ...nuevoVehiculo,
                        // Restricción de entrada: solo letras y espacios.
                        conductorHabitual: e.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, '')
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Departamento / Ubicación</label>
                    <select
                      className="form-input"
                      value={nuevoVehiculo.departamento || ''}
                      onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, departamento: e.target.value })}
                    >
                      <option value="">— Seleccione el departamento —</option>
                      {opcionesCatalogo(DEPARTAMENTOS_EL_SALVADOR, nuevoVehiculo.departamento).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ruta Asignada</label>
                    <select
                      className="form-input"
                      value={nuevoVehiculo.ruta || ''}
                      onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, ruta: e.target.value })}
                    >
                      <option value="">— Seleccione la ruta —</option>
                      {opcionesCatalogo(RUTAS_PREDETERMINADAS, nuevoVehiculo.ruta).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  El centro de costo se calcula desde el departamento:{' '}
                  <strong style={{ color: 'var(--color-accent)' }}>
                    {centroCostoPorDepartamento(nuevoVehiculo.departamento) || '—'}
                  </strong>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>
                  <TbPlus /> Registrar Ingreso al Inventario
                </button>
              </form>
            </div>
            )}

            {/* Listado de unidades registradas con QR y búsqueda */}
            <div className="card">
              <div className="form-section-title" style={{ marginTop: 0 }}>
                <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Flota Registrada ({flotaFiltrada.length})
              </div>

              <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
                <TbSearch className="search-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por placa, modelo o motorista..."
                  value={busquedaVehiculo}
                  onChange={e => setBusquedaVehiculo(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {flotaFiltrada.map(v => {
                  const estFotos = fotosEstado[normalizarPlaca(v.placa)] || {
                    completas: 0,
                    total: 4,
                    faltantes: ['frontal', 'lateralIzquierdo', 'lateralDerecho', 'trasera'],
                    completo: false
                  };
                  return (
                    <div
                      key={v.placa}
                      style={{
                        padding: '9px 12px',
                        background: 'var(--color-bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                          {v.placa}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                          {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ''}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 1 }}>
                          Conductor: <strong>{v.conductorHabitual || 'No asignado'}</strong> • Motor: {v.numMotor || 'S/N'} • VIN: {v.vin || 'S/N'}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontStyle: 'italic' }}>{v.ruta || 'Sin ruta asignada'}</span>
                          <span className="tech-tag" style={{ fontSize: 9.5 }}>
                            {v.departamento || '—'}
                          </span>
                          <span className="badge badge-info" style={{ fontSize: 9, padding: '2px 6px' }}>
                            {v.centroCosto || centroCostoPorDepartamento(v.departamento) || 'S/CENTRO'}
                          </span>
                        </div>
                        {/* Base fotográfica: se completa al ingresar la unidad al taller */}
                        <div style={{ fontSize: 10.5, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span
                            className={`badge ${estFotos?.completo ? 'badge-finalizado' : 'badge-info'}`}
                            style={{ fontSize: 9, padding: '2px 6px' }}
                            title="Base fotográfica: los 4 costados. Se completa cuando la unidad ingresa al taller."
                          >
                            <TbCamera size={11} style={{ verticalAlign: '-1.5px', marginRight: 4 }} />
                            {estFotos.completas}/{estFotos.total} fotos
                          </span>
                        </div>
                      </div>

                      <div className="btn-group">
                        <Link
                          to={`/admin/vehiculos/${encodeURIComponent(v.placa)}`}
                          className="btn btn-sm btn-primary"
                          title="Abrir la ficha completa: datos, motorista y sus 4 fotos"
                          style={{ padding: '3px 8px', fontSize: 11, textDecoration: 'none' }}
                        >
                          <TbTruck size={12} /> Ficha
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setAsignacionVehiculo({
                            ...v,
                            centroCosto: v.centroCosto || centroCostoPorDepartamento(v.departamento) || ''
                          })}
                          title="Cambiar ruta, ubicación y centro de costo (reubicación de la unidad)"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          <TbPencil size={12} /> Asignación
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setQrModalVehiculo(v)}
                          title="Generar e imprimir código QR para unidad"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          <TbPrinter size={12} /> QR
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger btn-icon"
                          onClick={() => handleEliminarVehiculo(v.placa)}
                          title="Dar de baja del inventario (venta u otro motivo)"
                          style={{ padding: '3px 7px' }}
                        >
                          <TbTrash size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN: RUTA / UBICACIÓN / CENTRO DE COSTO */}
      {asignacionVehiculo && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setAsignacionVehiculo(null)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">
                  Asignación de Unidad • <span style={{ fontFamily: 'var(--font-mono)' }}>{asignacionVehiculo.placa}</span>
                </h3>
                <button className="modal-close" onClick={() => setAsignacionVehiculo(null)}><TbX /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Actualice la ruta y ubicación asignada. El centro de costo se vinculará a los registros operativos.
                </p>

                <form onSubmit={handleGuardarAsignacion}>
                  <div className="form-grid" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Ruta Asignada</label>
                      <select
                        className="form-input"
                        value={asignacionVehiculo.ruta || ''}
                        onChange={e => setAsignacionVehiculo({ ...asignacionVehiculo, ruta: e.target.value })}
                      >
                        <option value="">— Seleccione la ruta —</option>
                        {opcionesCatalogo(RUTAS_PREDETERMINADAS, asignacionVehiculo.ruta).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Departamento / Ubicación</label>
                      <select
                        className="form-input"
                        value={asignacionVehiculo.departamento || ''}
                        onChange={e => setAsignacionVehiculo({
                          ...asignacionVehiculo,
                          departamento: e.target.value,
                          centroCosto: centroCostoPorDepartamento(e.target.value)
                        })}
                      >
                        <option value="">— Seleccione el departamento —</option>
                        {opcionesCatalogo(DEPARTAMENTOS_EL_SALVADOR, asignacionVehiculo.departamento).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Centro de Costo</label>
                      <select
                        className="form-input"
                        style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                        value={asignacionVehiculo.centroCosto || ''}
                        onChange={e => setAsignacionVehiculo({ ...asignacionVehiculo, centroCosto: e.target.value })}
                      >
                        <option value="">— Derivado del departamento —</option>
                        {opcionesCatalogo(CENTROS_COSTO, asignacionVehiculo.centroCosto).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Centro de costo sugerido:{' '}
                        <strong>{centroCostoPorDepartamento(asignacionVehiculo.departamento) || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setAsignacionVehiculo(null)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <TbCheck /> Guardar Asignación
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL PARA VER / IMPRIMIR QR DEL VEHÍCULO */}
      {qrModalVehiculo && (
        <ModalPortal>
          <div className="modal-overlay qr-print-parent" onClick={() => setQrModalVehiculo(null)}>
            <div className="modal" style={{ maxWidth: 420, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Código QR del Vehículo</h3>
                <button className="modal-close" onClick={() => setQrModalVehiculo(null)}><TbX /></button>
              </div>
              <div className="modal-body">
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {qrModalVehiculo.placa}
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
                  {qrModalVehiculo.marca} {qrModalVehiculo.modelo} • Pan Sinaí
                </div>

                {/* Generación QR mediante API SVG estándar */}
                <div style={{
                  background: '#fff',
                  padding: 16,
                  display: 'inline-block',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  marginBottom: 20
                }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('PANSINAI:' + qrModalVehiculo.placa)}`}
                    alt={`QR de ${qrModalVehiculo.placa}`}
                    style={{ width: 180, height: 180, display: 'block' }}
                  />
                </div>

                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                  Coloque este código QR en la unidad para agilizar la identificación y recepción en taller.
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => window.print()}
                >
                  <TbPrinter /> Imprimir Etiqueta QR
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: CONTRASEÑA TEMPORAL TRAS EL REINICIO */}
      {reinicioPassword && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setReinicioPassword(null)}>
            <div className="modal" style={{ maxWidth: 470 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TbLock /> Contraseña temporal
                </h3>
                <button className="modal-close" onClick={() => setReinicioPassword(null)} aria-label="Cerrar">
                  <TbX />
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 14px', lineHeight: 1.55 }}>
                  Entrega esta contraseña en mano a <strong>{reinicioPassword.usuario.nombre}</strong>.
                  Su contraseña anterior ya no funciona.
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-active)',
                  background: 'var(--color-bg-input)',
                  marginBottom: 14
                }}>
                  <code style={{
                    flex: 1,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent)',
                    userSelect: 'all',
                    wordBreak: 'break-all'
                  }}>
                    {reinicioPassword.temporal}
                  </code>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copiarPasswordTemporal}>
                    Copiar
                  </button>
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(234, 179, 8, 0.45)',
                  background: 'rgba(234, 179, 8, 0.10)',
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.55,
                  marginBottom: 4
                }}>
                  <TbAlertCircle size={14} style={{ color: '#e6b800', verticalAlign: -2, marginRight: 4 }} />
                  Esta contraseña se muestra <strong>una sola vez</strong> y no queda guardada en el historial.
                  Al ingresar, el sistema le exigirá crear una nueva (mínimo 8 caracteres, una mayúscula y un carácter especial).
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={() => setReinicioPassword(null)}>
                  <TbCheck /> Entendido
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
