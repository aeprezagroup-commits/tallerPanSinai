import { useState, useEffect, useRef } from 'react';
import { normalizarPlaca } from '../utils/placas';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  TbArrowLeft,
  TbPencil,
  TbDeviceFloppy,
  TbX,
  TbTrash,
  TbAlertCircle,
  TbUpload,
  TbTruck,
} from '../icons';
import ResumenErrores from '../components/ResumenErrores';
import {
  obtenerFlotaVehiculos, actualizarVehiculoCatalogo, eliminarVehiculoCatalogo,
  RUTAS_PREDETERMINADAS, DEPARTAMENTOS_EL_SALVADOR, centroCostoPorDepartamento,
  opcionesCatalogo,
} from '../services/vehiculosService';
import {
  obtenerFotosBase, guardarFotosBase, eliminarFotosVehiculo
} from '../services/fotosVehiculoService';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import IconoMascara from '../components/IconoMascara';

const LADOS_FICHA = [
  { key: 'frontal', num: '1', label: 'Frontal' },
  { key: 'lateralIzquierdo', num: '2', label: 'Lateral Izquierdo' },
  { key: 'lateralDerecho', num: '3', label: 'Lateral Derecho' },
  { key: 'trasera', num: '4', label: 'Trasera' },
];

const FORM_VACIO = {
  marca: '',
  modelo: '',
  tipo: '',
  anio: '',
  numMotor: '',
  vin: '',
  conductorHabitual: '',
  departamento: '',
  ruta: '',
  centroCosto: '',
  areaPredilecta: '',
  observaciones: '',
};

const Dato = ({ label, valor, ancho }) => (
  <div style={{ minWidth: ancho || 0 }}>
    <div style={{ fontSize: 10.5, letterSpacing: 1.1, fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 650, marginTop: 3, color: 'var(--color-text)', wordBreak: 'break-word' }}>
      {valor || '—'}
    </div>
  </div>
);

const Campo = ({ id, label, children, error }) => (
  <div className="form-group" style={{ marginBottom: 12 }}>
    <label htmlFor={id} style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7 }}>
      {label}
    </label>
    {children}
    {error && (
      <div style={{ color: '#e05a5a', fontSize: 11.5, marginTop: 4 }}>{error}</div>
    )}
  </div>
);

export default function VehiculoDetalle() {
  const { placa } = useParams();
  const navigate = useNavigate();
  const { addToast, confirm } = useToast();
  const { currentUser } = useAuth();

  const [vehiculo, setVehiculo] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [fotos, setFotos] = useState({});
  const [cargandoFotos, setCargandoFotos] = useState(true);
  const [actualizandoLado, setActualizandoLado] = useState('');
  const fotoInputRef = useRef(null);
  const ladoPendienteRef = useRef('');
  const [zoomFrontal, setZoomFrontal] = useState(false);

  useEffect(() => {
    const flota = obtenerFlotaVehiculos();
    const v = flota.find(
      x => normalizarPlaca(x.placa) === normalizarPlaca(placa)
    );
    if (!v) {
      setNoExiste(true);
      return;
    }
    setVehiculo(v);
    setForm({ ...FORM_VACIO, ...v, placa: v.placa });
    setNoExiste(false);
  }, [placa]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargandoFotos(true);
      const b = await obtenerFotosBase(placa);
      if (vivo) {
        setFotos(b || {});
        setCargandoFotos(false);
      }
    })();
    return () => { vivo = false; };
  }, [placa]);

  useEffect(() => {
    if (!zoomFrontal) return undefined;
    const alPresionar = e => {
      if (e.key === 'Escape') setZoomFrontal(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [zoomFrontal]);

  const setCampo = (campo, valor) => {
    setForm(prev => {
      const sig = { ...prev, [campo]: valor };
      if (campo === 'departamento' && !prev.centroCosto) {
        sig.centroCosto = centroCostoPorDepartamento(valor) || '';
      }
      return sig;
    });
  };

  const fotosLlenas = LADOS_FICHA.filter(l => Boolean(fotos[l.key])).length;
  const faltantesFotos = LADOS_FICHA.filter(l => !fotos[l.key]).map(l => l.label);
  const estadoFotos = {
    total: 4,
    completas: fotosLlenas,
    faltantes: faltantesFotos,
    completo: fotosLlenas === 4,
  };

  const handleGuardar = async e => {
    e.preventDefault();
    const err = {};
    if (!form.marca || form.marca.trim().length < 2) {
      err.marca = 'La marca es obligatoria (mínimo 2 letras).';
    }
    if (!form.modelo || !form.modelo.trim()) {
      err.modelo = 'El modelo es obligatorio.';
    }
    if (form.anio && !/^\d{4}$/.test(String(form.anio).trim())) {
      err.anio = 'El año debe ser un año válido de 4 dígitos.';
    }
    setErrores(err);
    if (Object.keys(err).length > 0) {
      addToast('Revisa los campos marcados antes de guardar.', 'error');
      return;
    }

    const confirmado = await confirm({
      title: '¿Guardar cambios de la ficha?',
      message: `Se actualizarán los datos técnicos de la placa "${vehiculo.placa}" en el catálogo.`,
      confirmText: 'Sí, guardar cambios',
      cancelText: 'Cancelar',
      danger: false
    });
    if (!confirmado) return;

    setGuardando(true);
    try {
      actualizarVehiculoCatalogo(vehiculo.placa, form);
      const actualizado = obtenerFlotaVehiculos()
        .find(v => v.placa === vehiculo.placa);
      setVehiculo(actualizado);
      setForm({ ...FORM_VACIO, ...actualizado, placa: actualizado.placa });
      setEditando(false);
      addToast(`Ficha de ${actualizado.placa} actualizada.`, 'success');
    } catch (e2) {
      addToast(e2.message || 'No se pudo actualizar la ficha.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const pedirFoto = (lado, desdeCamara = false) => {
    ladoPendienteRef.current = lado;
    if (fotoInputRef.current) {
      const inp = fotoInputRef.current;
      inp.value = '';
      if (desdeCamara) inp.setAttribute('capture', 'environment');
      else inp.removeAttribute('capture');
      inp.click();
    }
  };

  const handleFotoCargada = async e => {
    const archivo = e.target.files && e.target.files[0];
    const lado = ladoPendienteRef.current;
    if (!archivo || !lado) return;

    const etiqueta = LADOS_FICHA.find(l => l.key === lado)?.label || lado;

    if (fotos[lado]) {
      const ok = await confirm({
        title: `¿Reemplazar ${etiqueta.toLowerCase()}?`,
        message: `La foto actual de ${etiqueta.toLowerCase()} será borrada y sustituida por la nueva. ` +
          'La unidad siempre tendrá 4 fotos.',
        confirmText: 'Sí, reemplazar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
    }

    setActualizandoLado(lado);
    try {
      const res = await guardarFotosBase(vehiculo.placa, { [lado]: archivo }, currentUser);
      setFotos(res?.registro || {});
      if (res?.errores?.length) {
        addToast(`No se pudo guardar ${etiqueta}: se conservó la foto anterior.`, 'error');
      } else {
        addToast(`Foto ${etiqueta} de ${vehiculo.placa} actualizada.`, 'success');
      }
    } catch (e2) {
      addToast(e2.message || 'No se pudo guardar la foto.', 'error');
    } finally {
      setActualizandoLado('');
      ladoPendienteRef.current = '';
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const handleBaja = async () => {
    const ok = await confirm({
      title: '¿Dar de baja esta unidad?',
      message: `Se retirará el vehículo ${vehiculo.placa} del catálogo de flota y SE ELIMINARÁN ` +
        'sus 4 fotos de la base fotográfica. Esta acción no se puede deshacer.',
      confirmText: 'Sí, dar de baja',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!ok) return;

    try {
      await eliminarFotosVehiculo(vehiculo.placa);
    } catch {
    }
    eliminarVehiculoCatalogo(vehiculo.placa);
    addToast(`Unidad ${vehiculo.placa} dada de baja y sus fotos eliminadas.`, 'success');
    navigate('/admin/vehiculos');
  };

  if (noExiste) {
    return (
      <div className="content-wrapper">
        <div className="card" style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
          <TbTruck size={44} style={{ color: 'var(--color-text-muted)', opacity: 0.45 }} />
          <h2 style={{ margin: '12px 0 6px' }}>Unidad no encontrada</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            La placa <strong>{placa}</strong> no está en el catálogo de flota activo.
          </p>
          <Link to="/admin/vehiculos" className="btn btn-secondary" style={{ marginTop: 10 }}>
            <TbArrowLeft /> Volver a Vehículos
          </Link>
        </div>
      </div>
    );
  }

  if (!vehiculo) {
    return <div className="content-wrapper"><p style={{ color: 'var(--color-text-secondary)' }}>Cargando ficha…</p></div>;
  }

  return (
    <div className="content-wrapper">
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFotoCargada}
      />

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20,
      }}>
        <div style={{ minWidth: 0 }}>
          <Link to="/admin/vehiculos" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5,
            fontWeight: 750, color: 'var(--color-accent)', textDecoration: 'none', marginBottom: 8,
          }}>
            <TbArrowLeft size={15} /> Volver al listado
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {fotos.frontal ? (
              <button
                type="button"
                onClick={() => setZoomFrontal(true)}
                title="Ver foto frontal en grande"
                aria-label={`Ver foto frontal de ${vehiculo.placa} en grande`}
                style={{
                  width: 64, height: 64, padding: 0, flexShrink: 0,
                  borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in',
                  border: '2px solid rgba(20,148,68,0.45)',
                  background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                }}
              >
                <img
                  src={fotos.frontal}
                  alt={`Foto frontal de ${vehiculo.placa}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--brand-green), #127a44)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TbTruck size={24} color="#fff" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, letterSpacing: 1.6, fontWeight: 850, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                {vehiculo.tipo || 'Unidad de flota'}
              </div>
              <h1 style={{ fontSize: 25, fontWeight: 850, letterSpacing: -0.7, margin: '2px 0 0', wordBreak: 'break-word' }}>
                {vehiculo.placa}
              </h1>
              <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 800,
            background: estadoFotos.completo ? 'rgba(20,148,68,0.14)' : 'rgba(134,153,46,0.11)',
            color: estadoFotos.completo ? 'var(--color-finalizado)' : 'var(--color-accent)',
            border: `1px solid ${estadoFotos.completo ? 'rgba(20,148,68,0.4)' : 'rgba(134,153,46,0.35)'}`,
          }}>
            <IconoMascara src="/iconos/camara-fotografica.png" size={14} />
            {estadoFotos.completas}/4 fotos
          </span>

          {editando ? (
            <>
              <button type="button" className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                <TbDeviceFloppy /> {guardando ? 'Guardando…' : 'Guardar Ficha'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setEditando(false);
                setErrores({});
                setForm({ ...FORM_VACIO, ...vehiculo, placa: vehiculo.placa });
              }}>
                <TbX /> Cancelar
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setEditando(true)}>
              <TbPencil /> Editar Ficha
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/taller-reparacion.png" size={16} /> Datos de la Unidad
        </div>

        {editando ? (
          <form onSubmit={handleGuardar} style={{ marginTop: 14 }}>
            <ResumenErrores errores={errores} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '0 14px' }}>
              <Campo id="f-marca" label="Marca *" error={errores.marca}>
                <input id="f-marca" className="form-input" value={form.marca}
                  onChange={e => setCampo('marca', e.target.value)} placeholder="Marca del fabricante" />
              </Campo>
              <Campo id="f-modelo" label="Modelo *" error={errores.modelo}>
                <input id="f-modelo" className="form-input" value={form.modelo}
                  onChange={e => setCampo('modelo', e.target.value)} placeholder="Modelo de la unidad" />
              </Campo>
              <Campo id="f-tipo" label="Tipo de unidad">
                <input id="f-tipo" className="form-input" value={form.tipo}
                  onChange={e => setCampo('tipo', e.target.value)} placeholder="Tipo de unidad" />
              </Campo>
              <Campo id="f-anio" label="Año" error={errores.anio}>
                <input id="f-anio" className="form-input" value={form.anio}
                  onChange={e => setCampo('anio', e.target.value)} placeholder="Año (AAAA)" inputMode="numeric" />
              </Campo>
              <Campo id="f-motor" label="N.º de motor">
                <input id="f-motor" className="form-input" value={form.numMotor}
                  onChange={e => setCampo('numMotor', e.target.value)} placeholder="Número de motor" />
              </Campo>
              <Campo id="f-vin" label="VIN">
                <input id="f-vin" className="form-input" value={form.vin}
                  onChange={e => setCampo('vin', e.target.value)} placeholder="Número de chasis / VIN" />
              </Campo>
              <Campo id="f-depto" label="Departamento">
                <select id="f-depto" className="form-input" value={form.departamento || ''}
                  onChange={e => setCampo('departamento', e.target.value)}>
                  <option value="">— Seleccione el departamento —</option>
                  {opcionesCatalogo(DEPARTAMENTOS_EL_SALVADOR, form.departamento).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="f-ruta" label="Ruta asignada">
                <select id="f-ruta" className="form-input" value={form.ruta || ''}
                  onChange={e => setCampo('ruta', e.target.value)}>
                  <option value="">— Seleccione la ruta —</option>
                  {opcionesCatalogo(RUTAS_PREDETERMINADAS, form.ruta).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="f-centro" label="Centro de costo">
                <input id="f-centro" className="form-input" value={form.centroCosto}
                  onChange={e => setCampo('centroCosto', e.target.value)} placeholder="Se deriva del departamento" />
              </Campo>
              <Campo id="f-area" label="Área predilecta">
                <input id="f-area" className="form-input" value={form.areaPredilecta}
                  onChange={e => setCampo('areaPredilecta', e.target.value)} placeholder="Área técnica asignada" />
              </Campo>
            </div>

            <Campo id="f-obs" label="Observaciones">
              <textarea id="f-obs" rows={2} value={form.observaciones}
                onChange={e => setCampo('observaciones', e.target.value)}
                placeholder="Notas sobre la unidad" className="form-input" style={{ width: '100%' }} />
            </Campo>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 6 }} disabled={guardando}>
              <TbDeviceFloppy /> {guardando ? 'Guardando…' : 'Guardar Ficha'}
            </button>
          </form>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))',
            gap: '16px 14px', marginTop: 14,
          }}>
            <Dato label="Placa" valor={vehiculo.placa} />
            <Dato label="Marca" valor={vehiculo.marca} />
            <Dato label="Modelo" valor={vehiculo.modelo} />
            <Dato label="Tipo" valor={vehiculo.tipo} />
            <Dato label="Año" valor={vehiculo.anio} />
            <Dato label="N.º de motor" valor={vehiculo.numMotor} />
            <Dato label="VIN" valor={vehiculo.vin} />
            <Dato label="Departamento" valor={vehiculo.departamento} />
            <Dato label="Ruta asignada" valor={vehiculo.ruta} />
            <Dato label="Centro de costo" valor={vehiculo.centroCosto} />
            <Dato label="Área predilecta" valor={vehiculo.areaPredilecta} />
            <Dato label="Observaciones" valor={vehiculo.observaciones} />
          </div>
        )}
      </div>

      <div className="card" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(16,148,68,0.07), var(--color-bg-card))',
      }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/personal-taller.png" size={16} /> Motorista Asignado
        </div>

        <div style={{
          display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 14,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--brand-green), #0f7a44)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 850, fontSize: 19, letterSpacing: -0.5,
          }}>
            {(vehiculo.conductorHabitual || '?').trim().charAt(0).toUpperCase()}
          </div>

          <div style={{ minWidth: 180, flex: 1 }}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.1, fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Conductor habitual
            </div>
            {editando ? (
              <input
                className="form-input"
                value={form.conductorHabitual}
                onChange={e => setCampo('conductorHabitual',
                  e.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, ''))}
                placeholder="Nombre del motorista"
                style={{ marginTop: 5, maxWidth: 340 }}
              />
            ) : (
              <div style={{
                fontSize: 18, fontWeight: 800, letterSpacing: -0.3, marginTop: 2,
                color: vehiculo.conductorHabitual ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}>
                {vehiculo.conductorHabitual || 'Sin motorista asignado'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 10, flexWrap: 'wrap',
        }}>
          <div className="form-section-title" style={{ marginTop: 0, marginBottom: 0 }}>
            <IconoMascara className="icon" src="/iconos/camara-fotografica.png" size={16} /> Base Fotográfica ({fotosLlenas}/4)
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', maxWidth: 420, textAlign: 'right' }}>
            Se completa al ingresar la unidad al taller.
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
          gap: 12, marginTop: 16,
        }}>
          {LADOS_FICHA.map(lado => {
            const foto = fotos[lado.key];
            const ocupado = actualizandoLado === lado.key;
            return (
              <div key={lado.key} style={{
                border: `1px solid ${foto ? 'rgba(20,148,68,0.4)' : 'rgba(234,179,8,0.45)'}`,
                borderRadius: 10, overflow: 'hidden', background: 'var(--color-bg-card)',
              }}>
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '4 / 3',
                  background: foto ? '#000' : 'linear-gradient(135deg, rgba(234,179,8,0.07), rgba(234,179,8,0.02))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {foto ? (
                    <img src={foto} alt={lado.label}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 750, color: '#e6b800', textAlign: 'center', padding: 8 }}>
                      Falta costado {lado.num}
                    </span>
                  )}
                  <span style={{
                    position: 'absolute', top: 6, left: 6,
                    background: 'rgba(0,0,0,0.68)', color: '#fff', borderRadius: 5,
                    fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '2px 6px',
                  }}>
                    {lado.num}
                  </span>
                </div>
                <div style={{ padding: '7px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 750, color: 'var(--color-text)' }}>
                    {lado.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button type="button"
                      className={foto ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => pedirFoto(lado.key, true)}
                      disabled={ocupado}
                      style={{
                        width: '100%', justifyContent: 'center', padding: '6px 6px', fontSize: 12,
                        gridColumn: ocupado ? '1 / -1' : 'auto',
                      }}>
                      <IconoMascara src="/iconos/camara-fotografica.png" size={12} />
                      {ocupado ? 'Procesando…' : 'Cámara'}
                    </button>
                    {!ocupado && (
                      <button type="button"
                        className="btn btn-secondary"
                        onClick={() => pedirFoto(lado.key, false)}
                        style={{ width: '100%', justifyContent: 'center', padding: '6px 6px', fontSize: 12 }}>
                        <TbUpload />
                        Subir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {faltantesFotos.length > 0 && (
          <div style={{
            marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '11px 13px', borderRadius: 9,
            background: 'rgba(134,153,46,0.09)', border: '1px solid rgba(134,153,46,0.3)',
          }}>
            <TbAlertCircle size={19} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, textTransform: 'none' }}>
              <strong>Sin fotos registradas:</strong>{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {faltantesFotos.join(', ')}. La base fotográfica se completa cuando la unidad ingresa al taller.
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={handleBaja}
          style={{ color: '#e05a5a', borderColor: 'rgba(224,90,90,0.45)' }}>
          <TbTrash /> Dar de baja la unidad
        </button>
      </div>

      {zoomFrontal && fotos.frontal && (
        <div
          className="modal-overlay"
          onClick={() => setZoomFrontal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Foto frontal ampliada"
        >
          <div
            className="modal"
            style={{ maxWidth: 620 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Foto frontal — {vehiculo.placa}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setZoomFrontal(false)}
                aria-label="Cerrar visor"
              >
                <TbX />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 12, background: '#000' }}>
              <img
                src={fotos.frontal}
                alt={`Foto frontal de ${vehiculo.placa}`}
                style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
