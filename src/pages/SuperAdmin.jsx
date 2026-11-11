import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbShield, TbArrowLeft, TbUsers, TbTruck, TbClipboardList,
  TbReceipt, TbImages, TbDatabase, TbGauge, TbSearch,
  TbTrash, TbRefresh, TbLock, TbServer, TbCircleCheck, TbFilter,
  TbPlus,
} from '../icons';
import PanelCatalogos from '../components/PanelCatalogos';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  leerBitacora, contarBitacora, colaPendiente, podarBitacora,
} from '../services/bitacoraService';
import { leerMetricas } from '../services/metricasService';
import {
  obtenerPersonalVisible, obtenerUsuarios, crearCuentaSoporte, esSuperAdmin, migrarPasswordsAHash,
} from '../services/usuariosService';
import { esHashBcrypt } from '../utils/passwords';
import { obtenerFlotaVehiculos } from '../services/vehiculosService';
import { db, isFirebaseConfigured } from '../firebase/config';
import { getCountFromServer, collection } from 'firebase/firestore';

function formatoBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatoNumero(n) {
  return (Number(n) || 0).toLocaleString('es-SV');
}

function fechaLegible(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const COLOR_TIPO = {
  sesion: '#4f8ef7',
  usuario: '#e0a300',
  vehiculo: '#2fbf71',
  foto: '#9b6dff',
  orden: '#ff7a59',
  gasto: '#e35d8f',
  sistema: '#8a93a6',
};

const FILTROS = [
  { id: 'todo', etiqueta: 'Todo', icono: <TbFilter /> },
  { id: 'sesion', etiqueta: 'Sesiones', icono: <TbLock /> },
  { id: 'usuario', etiqueta: 'Personal', icono: <TbUsers /> },
  { id: 'vehiculo', etiqueta: 'Vehículos', icono: <TbTruck /> },
  { id: 'foto', etiqueta: 'Fotos', icono: <TbImages /> },
  { id: 'orden', etiqueta: 'Órdenes', icono: <TbClipboardList /> },
  { id: 'gasto', etiqueta: 'Gastos', icono: <TbReceipt /> },
  { id: 'eliminaciones', etiqueta: 'Eliminaciones', icono: <TbTrash /> },
];

function Tarjeta({ icono, etiqueta, valor, detalle, color }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      minWidth: 190,
      flex: '1 1 190px',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
        background: `${color || '#4f8ef7'}1f`, color: color || '#4f8ef7', fontSize: 16, flexShrink: 0,
      }}>
        {icono}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.65 }}>
          {etiqueta}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{valor}</div>
        {detalle && (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{detalle}</div>
        )}
      </div>
    </div>
  );
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();
  const { addToast, confirm } = useToast();

  const [cargando, setCargando] = useState(true);
  const [eventos, setEventos] = useState([]);
  const [totalEventos, setTotalEventos] = useState(0);
  const [metricas, setMetricas] = useState(null);
  const [conteos, setConteos] = useState({});
  const [pendientes, setPendientes] = useState(0);
  const [aviso, setAviso] = useState('');
  const [migrandoPass, setMigrandoPass] = useState(false);
  const [, setTickPass] = useState(0);

  const [filtro, setFiltro] = useState('todo');
  const [busqueda, setBusqueda] = useState('');
  const [visibles, setVisibles] = useState(60);

  const recargar = useCallback(async () => {
    setCargando(true);
    setAviso('');
    try {
      const [b, m] = await Promise.all([
        leerBitacora(1000),
        leerMetricas(),
      ]);
      setEventos(b.eventos || []);
      setMetricas(m);

      const c = await contarBitacora();
      setTotalEventos(c);
      setPendientes(colaPendiente());

      if (isFirebaseConfigured && db) {
        const colecciones = ['ordenes_trabajo', 'gastos_vehiculo', 'vehiculos_fotos_base'];
        const resultados = await Promise.all(
          colecciones.map((nombre) => getCountFromServer(collection(db, nombre))
            .then((r) => r.data().count).catch(() => 0)),
        );
        setConteos({
          ordenes: resultados[0],
          gastos: resultados[1],
          fotos: resultados[2],
        });
      }
    } catch (e) {
      setAviso(`No se pudo leer la bitácora: ${e?.message || e}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const usuarios = obtenerPersonalVisible();
  const flota = obtenerFlotaVehiculos();

  const [formSoporte, setFormSoporte] = useState(false);
  const [nombreSoporte, setNombreSoporte] = useState('admin');
  const [passSoporte, setPassSoporte] = useState('');
  const [errorSoporte, setErrorSoporte] = useState('');
  const haySoporte = obtenerUsuarios().some(esSuperAdmin);
  const modoInstalacion = !isSuperAdmin && !haySoporte;
  const passPendientes = obtenerUsuarios().filter((u) => u && u.password && !esHashBcrypt(u.password)).length;

  const crearSoporte = async (e) => {
    e.preventDefault();
    setErrorSoporte('');
    const confirmado = await confirm({
      title: '¿Crear la cuenta de soporte?',
      message: `Se creará el usuario "${nombreSoporte}" con rol super administrador: será la única cuenta que entre a /admin-secreto/bitacora y verá todo el sistema. Su contraseña no podrá reiniciarse desde Personal.`,
      confirmText: 'Sí, crear la cuenta',
      cancelText: 'Cancelar',
    });
    if (!confirmado) return;
    try {
      const creado = await crearCuentaSoporte({
        nombre: nombreSoporte,
        password: passSoporte,
        por: currentUser?.nombre || 'Administración',
      });
      setPassSoporte('');
      setFormSoporte(false);
      addToast(`Cuenta de soporte "${creado.nombre}" creada. Entra con esa cuenta para usar la consola.`, 'success');
    } catch (err) {
      const mensaje = err?.message || 'No se pudo crear la cuenta de soporte.';
      setErrorSoporte(mensaje);
      addToast(mensaje, 'error');
    }
  };

  const migrarPasswords = async () => {
    const pendientes = obtenerUsuarios().filter((u) => u && u.password && !esHashBcrypt(u.password)).length;
    if (pendientes === 0) {
      addToast('Todas las contraseñas ya están en formato seguro.', 'success');
      return;
    }
    const confirmado = await confirm({
      title: '¿Migrar contraseñas al formato seguro?',
      message: `Se guardarán ${pendientes} contraseña(s) en formato hash. Los usuarios seguirán entrando con su misma contraseña: sólo cambia la forma en que se almacena.`,
      confirmText: 'Sí, migrar',
      cancelText: 'Cancelar',
    });
    if (!confirmado) return;
    setMigrandoPass(true);
    try {
      const r = await migrarPasswordsAHash();
      setTickPass((t) => t + 1);
      if (r.fallos > 0) {
        addToast(`Se migraron ${r.migrados} contraseña(s) y ${r.fallos} fallaron. Reintenta la migración.`, 'error');
      } else {
        addToast(`${r.migrados} contraseña(s) migradas al formato seguro.`, 'success');
      }
    } catch (err) {
      addToast(err?.message || 'No se pudo migrar las contraseñas.', 'error');
    } finally {
      setMigrandoPass(false);
    }
  };

  const filtrados = eventos.filter((ev) => {
    if (filtro === 'eliminaciones') {
      const esBorrado = ev.accion === 'eliminar' || ev.accion === 'baja';
      if (!esBorrado) return false;
    } else if (filtro !== 'todo' && ev.tipo !== filtro) {
      return false;
    }
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const heno = `${ev.detalle || ''} ${ev.usuario || ''} ${ev.accion || ''} ${JSON.stringify(ev.datos || {})}`.toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  });

  const aMostrar = filtrados.slice(0, visibles);

  const conteoTipo = (id) => {
    if (id === 'todo') return eventos.length;
    if (id === 'eliminaciones') {
      return eventos.filter((e) => e.accion === 'eliminar' || e.accion === 'baja').length;
    }
    return eventos.filter((e) => e.tipo === id).length;
  };

  const podar = async () => {
    const r = await podarBitacora();
    setAviso(r.borrados > 0
      ? `Se eliminaron ${r.borrados} eventos viejos (quedaban ${r.total}).`
      : 'La bitácora está dentro del límite, no había nada que podar.');
    recargar();
  };

  const irAtras = () => navigate('/admin');

  const panel = { maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' };
  const caja = {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
  };

  return (
    <div style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        position: 'relative', zIndex: 20,
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={irAtras}
            title="Volver al panel de administración"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)', borderRadius: 8,
              padding: '8px 12px', cursor: 'pointer', fontSize: 13,
            }}
          >
            <TbArrowLeft /> Volver
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: '#e0a30026', color: '#e0a300', fontSize: 16,
            }}>
              <TbShield />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                Consola de Auditoría
              </div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                Super administración · uso, eliminaciones y consumo del sistema
              </div>
            </div>
          </div>

          <span style={{
            fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            background: '#e0a30026', color: '#e0a300',
            border: '1px solid #e0a30055', borderRadius: 999, padding: '5px 11px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <TbLock /> Acceso restringido
          </span>

          <button
            type="button"
            onClick={recargar}
            title="Volver a leer la base"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)', borderRadius: 8,
              padding: '8px 12px', cursor: 'pointer', fontSize: 13,
            }}
          >
            <TbRefresh className={cargando ? 'girando' : ''} /> Actualizar
          </button>
        </div>
      </header>

      <div style={panel}>
        {aviso && (
          <div style={{
            ...caja, padding: '10px 14px', marginBottom: 16,
            borderLeft: '3px solid #4f8ef7', fontSize: 13,
          }}>
            {aviso}
          </div>
        )}

        {modoInstalacion && (
          <section style={{ ...caja, padding: '18px 18px 20px', marginBottom: 20, borderLeft: '3px solid #e0a300' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
                background: '#e0a30026', color: '#e0a300',
              }}>
                <TbLock />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Crear la cuenta de soporte</div>
                <div style={{ fontSize: 11.5, opacity: 0.65 }}>
                  La consola queda reservada al super administrador. Créala una única vez: su contraseña
                  no podrá reiniciarse desde Personal.
                </div>
              </div>
            </div>

            {!formSoporte ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormSoporte(true)}>
                <TbPlus size={14} /> Crear cuenta de soporte
              </button>
            ) : (
              <form onSubmit={crearSoporte} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 11.5, opacity: 0.8, display: 'block' }}>
                  Usuario
                  <input
                    className="form-input"
                    value={nombreSoporte}
                    onChange={e => setNombreSoporte(e.target.value)}
                    style={{ minWidth: 160 }}
                    autoComplete="off"
                  />
                </label>
                <label style={{ fontSize: 11.5, opacity: 0.8, display: 'block' }}>
                  Contraseña
                  <input
                    className="form-input"
                    type="password"
                    value={passSoporte}
                    onChange={e => setPassSoporte(e.target.value)}
                    placeholder="Mínimo 8, una mayúscula y un especial"
                    style={{ minWidth: 230 }}
                    autoComplete="new-password"
                  />
                </label>
                <button type="submit" className="btn btn-success btn-sm">
                  <TbShield size={14} /> Crear
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setFormSoporte(false); setErrorSoporte(''); }}
                >
                  Cancelar
                </button>
                {errorSoporte && (
                  <div style={{ flexBasis: '100%', color: '#ef4444', fontSize: 12.5, textTransform: 'none' }}>
                    {errorSoporte}
                  </div>
                )}
              </form>
            )}
          </section>
        )}

        {isSuperAdmin && <PanelCatalogos />}

        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.65, margin: '0 0 12px' }}>
            Resumen del sistema
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Tarjeta icono={<TbUsers />} etiqueta="Personal" valor={formatoNumero(usuarios.length)}
              detalle={`${usuarios.filter((u) => u.activo !== false).length} activo(s)`} color="#e0a300" />
            <Tarjeta icono={<TbTruck />} etiqueta="Flota" valor={formatoNumero(flota.length)}
              detalle="unidades en catálogo" color="#2fbf71" />
            <Tarjeta icono={<TbClipboardList />} etiqueta="Órdenes" valor={formatoNumero(conteos.ordenes)}
              detalle="en la base" color="#ff7a59" />
            <Tarjeta icono={<TbReceipt />} etiqueta="Gastos" valor={formatoNumero(conteos.gastos)}
              detalle="registros" color="#e35d8f" />
            <Tarjeta icono={<TbImages />} etiqueta="Fotos" valor={formatoNumero(conteos.fotos)}
              detalle="unidades con base fotográfica" color="#9b6dff" />
            <Tarjeta icono={<TbDatabase />} etiqueta="Bitácora" valor={formatoNumero(totalEventos)}
              detalle={pendientes > 0 ? `${pendientes} pendiente(s) de enviar` : 'todo sincronizado'}
              color="#4f8ef7" />
          </div>
        </section>

        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.65, margin: '0 0 12px' }}>
            <TbGauge style={{ marginRight: 8 }} />
            Consumo real de la aplicación
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Tarjeta icono={<TbServer />} etiqueta="Lecturas" valor={formatoNumero(metricas?.lecturas)}
              detalle="operaciones de lectura" color="#4f8ef7" />
            <Tarjeta icono={<TbDatabase />} etiqueta="Escrituras" valor={formatoNumero(metricas?.escrituras)}
              detalle="operaciones de escritura" color="#2fbf71" />
            <Tarjeta icono={<TbGauge />} etiqueta="Leídos" valor={formatoBytes(metricas?.bytesLeidos)}
              detalle="aproximados" color="#9b6dff" />
            <Tarjeta icono={<TbGauge />} etiqueta="Escritos" valor={formatoBytes(metricas?.bytesEscritos)}
              detalle="aproximados" color="#e35d8f" />
            <Tarjeta icono={<TbLock />} etiqueta="Sesiones" valor={formatoNumero(metricas?.sesiones)}
              detalle="inicios de sesión" color="#e0a300" />
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TbCircleCheck style={{ color: '#2fbf71' }} />
            Los contadores se envían agrupados una vez por minuto para no consumir de más.
            Origen: {metricas?.origen || '—'}
            {metricas?.origen === 'nuevo' ? ' (aún no hay mediciones)' : ''}
          </div>
        </section>

        <section>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 12,
          }}>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.65, margin: 0 }}>
              Seguridad de accesos
            </h2>
            <button
              type="button"
              onClick={migrarPasswords}
              disabled={migrandoPass}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', borderRadius: 8,
                padding: '7px 11px', cursor: migrandoPass ? 'wait' : 'pointer',
                fontSize: 12, opacity: migrandoPass ? 0.6 : 1,
              }}
              title="Guarda las contraseñas en formato seguro (hash) para que no sean legibles"
            >
              <TbShield /> {migrandoPass ? 'Migrando…' : 'Migrar contraseñas'}
            </button>
          </div>

          <div style={{
            ...caja, padding: 14, marginBottom: 14,
            fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {passPendientes === 0
              ? <TbCircleCheck style={{ color: '#2fbf71', flexShrink: 0 }} />
              : <TbLock style={{ color: '#e0a300', flexShrink: 0 }} />}
            {passPendientes === 0
              ? 'Todas las contraseñas están guardadas en formato seguro (hash).'
              : `${passPendientes} contraseña(s) aún en texto plano. Migralas para que no sean legibles.`}
          </div>
        </section>

        <section>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 12,
          }}>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.65, margin: 0 }}>
              Bitácora de uso
            </h2>
            <button
              type="button"
              onClick={podar}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', borderRadius: 8,
                padding: '7px 11px', cursor: 'pointer', fontSize: 12,
              }}
              title="Elimina los eventos más viejos si se pasa de 4.000"
            >
              <TbTrash /> Podar registro
            </button>
          </div>

          <div style={{ ...caja, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {FILTROS.map((f) => {
                const activo = filtro === f.id;
                const n = conteoTipo(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setFiltro(f.id); setVisibles(60); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      background: activo ? '#4f8ef726' : 'transparent',
                      color: activo ? '#4f8ef7' : 'var(--color-text-primary)',
                      border: `1px solid ${activo ? '#4f8ef7' : 'var(--color-border)'}`,
                      borderRadius: 999, padding: '6px 12px',
                      cursor: 'pointer', fontSize: 12.5,
                    }}
                  >
                    {f.icono} {f.etiqueta}
                    <span style={{ opacity: 0.7, fontSize: 11 }}>{n}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative' }}>
              <TbSearch style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                opacity: 0.5, fontSize: 13,
              }} />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setVisibles(60); }}
                placeholder="Buscar por persona, placa, texto o acción…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '9px 12px 9px 34px',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={caja}>
            {cargando ? (
              <div style={{ padding: 30, textAlign: 'center', opacity: 0.65, fontSize: 13 }}>
                Leyendo la bitácora…
              </div>
            ) : aMostrar.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', opacity: 0.65, fontSize: 13 }}>
                No hay eventos que coincidan con el filtro.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.7 }}>
                      {['Fecha', 'Tipo', 'Acción', 'Detalle', 'Persona'].map((h) => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '11px 14px',
                          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aMostrar.map((ev) => (
                      <tr key={ev.id || `${ev.fechaMs}-${ev.detalle}`}
                        style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12, opacity: 0.85 }}>
                          {fechaLegible(ev.fechaMs)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block', fontSize: 11, fontWeight: 600,
                            padding: '3px 9px', borderRadius: 999,
                            background: `${COLOR_TIPO[ev.tipo] || '#8a93a6'}26`,
                            color: COLOR_TIPO[ev.tipo] || '#8a93a6',
                            textTransform: 'capitalize',
                          }}>
                            {ev.tipo}
                          </span>
                        </td>
                        <td style={{
                          padding: '10px 14px', fontSize: 12, textTransform: 'capitalize',
                          color: ev.accion === 'eliminar' || ev.accion === 'baja' ? '#e35d8f' : undefined,
                          fontWeight: ev.accion === 'eliminar' || ev.accion === 'baja' ? 600 : 400,
                        }}>
                          {ev.accion}
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: 260 }}>
                          {ev.detalle}
                          {ev.datos && Object.keys(ev.datos).length > 0 && (
                            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>
                              {Object.entries(ev.datos)
                                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                                .join(' · ')
                                .slice(0, 160)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12 }}>
                          <div>{ev.usuario || '—'}</div>
                          <div style={{ fontSize: 11, opacity: 0.55 }}>{ev.rol || ''}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!cargando && filtrados.length > aMostrar.length && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setVisibles((v) => v + 60)}
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '9px 18px',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Mostrar más ({formatoNumero(filtrados.length - aMostrar.length)} restantes)
              </button>
            </div>
          )}
        </section>

        <footer style={{
          marginTop: 34, paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
          fontSize: 11.5, opacity: 0.6,
          display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <span>Consola oculta · reservada al super administrador · no aparece en Ctrl+K</span>
          <span>
            Mostrando {formatoNumero(aMostrar.length)} de {formatoNumero(filtrados.length)} eventos
            {totalEventos > eventos.length ? ` · ${formatoNumero(totalEventos)} en total` : ''}
          </span>
        </footer>
      </div>
    </div>
  );
}
