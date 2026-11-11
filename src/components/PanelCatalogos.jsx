import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TbTruck, TbList, TbClipboardList, TbPlus, TbTrash, TbDeviceFloppy,
  TbAlertCircle, TbRefresh, TbSearch,
} from '../icons';
import { useToast } from './ToastContext';
import { useAuth } from '../context/AuthContext';
import { DEPARTAMENTOS_EL_SALVADOR, obtenerEditorRutas } from '../services/vehiculosService';
import { obtenerEditorTareas } from '../services/catalogoTareasService';
import { AREAS_TRABAJO, AREAS_CON_CODIGO } from '../constants/areas';
import {
  guardarCatalogoRutas, guardarCatalogoAreas, guardarCatalogoTareas,
  estadoCatalogos, suscribirCatalogos,
} from '../services/catalogosService';

// Pestañas del editor de catálogos
const PESTANAS = [
  { id: 'rutas', etiqueta: 'Rutas de camiones', icono: <TbTruck size={16} /> },
  { id: 'areas', etiqueta: 'Áreas del taller', icono: <TbList size={16} /> },
  { id: 'tareas', etiqueta: 'Tareas del checklist', icono: <TbClipboardList size={16} /> },
];

// Copia de trabajo del catálogo de áreas (valores en memoria)
function copiaAreas() {
  return {
    areas: [...AREAS_TRABAJO],
    codigos: Object.fromEntries(AREAS_CON_CODIGO.map(c => [c.nombre, c.codigo])),
  };
}

// Filas de tarea listas para editar, según el grupo elegido:
//   mantenimiento → índices sobre base5000 / extendidas20000
//   reparación     → textos del área (empresa) + genéricas del área
function filasDeGrupo(grupo, area, editor) {
  if (grupo === 'mtto5000') {
    return editor.mantenimiento.base5000.map((t, idx) => ({ ...t, origen: 'base', idx }));
  }
  if (grupo === 'mtto20000') {
    const base = editor.mantenimiento.base5000.map((t, idx) => ({ ...t, origen: 'base', idx }));
    const extra = editor.mantenimiento.extendidas20000.map((t, idx) => ({ ...t, origen: 'extra', idx }));
    return [...base, ...extra];
  }
  const empresa = (editor.empresa[area] || []).map((texto, idx) => ({
    clave: `empresa:${idx}`,
    descripcion: texto,
    area,
    tiempoEstimadoMinutos: 60,
    origen: 'empresa',
    idx,
  }));
  const genericas = editor.genericas
    .map((t, idx) => ({ ...t, origen: 'generica', idx }))
    .filter(t => t.area === area);
  return [...empresa, ...genericas];
}

/**
 * CONSOLA DE CATÁLOGOS — solo para el super administrador.
 * Rutas de camiones, áreas del taller y tareas del checklist, editadas
 * desde aquí y guardadas en Firestore: no hace falta tocar la base.
 */
export default function PanelCatalogos() {
  const { currentUser } = useAuth();
  const { addToast, confirm } = useToast();

  const [pestana, setPestana] = useState('rutas');
  const [info, setInfo] = useState(estadoCatalogos());
  const [sucio, setSucio] = useState({ rutas: false, areas: false, tareas: false });
  const [guardando, setGuardando] = useState(false);

  const [rutas, setRutas] = useState(() => obtenerEditorRutas());
  const [areas, setAreas] = useState(copiaAreas);
  const [tareas, setTareas] = useState(() => obtenerEditorTareas());

  // Grupos de tareas: mantenimiento + una entrada por área de reparación
  const grupos = [
    { id: 'mtto5000', etiqueta: 'Mantenimiento · 5,000 km' },
    { id: 'mtto20000', etiqueta: 'Mantenimiento · 20,000 km' },
    ...AREAS_TRABAJO.map(a => ({ id: `rep:${a}`, etiqueta: `Reparación · ${a}` })),
  ];

  const [grupoSel, setGrupoSel] = useState('rep:Motor');
  const [busquedaTarea, setBusquedaTarea] = useState('');

  // Si el área elegida dejó de existir en el catálogo, se vuelve al primero
  const grupoActual = grupos.some(g => g.id === grupoSel)
    ? grupoSel
    : (grupos[0]?.id || 'mtto5000');

  // Al cargar desde Firestore (o al guardar) se refresca la copia de trabajo
  const reiniciar = useCallback(() => {
    setRutas(obtenerEditorRutas());
    setAreas(copiaAreas());
    setTareas(obtenerEditorTareas());
    setSucio({ rutas: false, areas: false, tareas: false });
  }, []);

  useEffect(() => suscribirCatalogos((estado) => {
    setInfo(estado);
    reiniciar();
  }), [reiniciar]);

  const marcar = (quien) => setSucio(s => ({ ...s, [quien]: true }));

  // ---------------------------------------------------------------- RUTAS
  const editarRuta = (i, valor) => {
    setRutas(r => ({ ...r, predeterminadas: r.predeterminadas.map((x, j) => (j === i ? valor : x)) }));
    marcar('rutas');
  };

  const eliminarRuta = async (i, valor) => {
    const confirmado = await confirm({
      title: '¿Eliminar la ruta?',
      message: `Se quitará "${valor}" del catálogo y de los departamentos que la usen. Las personas que la tengan asignada quedarán sin esa ruta.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!confirmado) return;
    setRutas(r => ({
      ...r,
      predeterminadas: r.predeterminadas.filter((_, j) => j !== i),
      porDepartamento: Object.fromEntries(
        Object.entries(r.porDepartamento).map(([d, lista]) => [d, lista.filter(x => x !== valor)]),
      ),
    }));
    marcar('rutas');
  };

  const [nuevaRuta, setNuevaRuta] = useState('');
  const agregarRuta = () => {
    const valor = nuevaRuta.trim();
    if (!valor) return;
    if (rutas.predeterminadas.some(r => r.toLowerCase() === valor.toLowerCase())) {
      addToast('Esa ruta ya está en el catálogo', 'warning');
      return;
    }
    setRutas(r => ({ ...r, predeterminadas: [...r.predeterminadas, valor] }));
    setNuevaRuta('');
    marcar('rutas');
  };

  const [deptoSel, setDeptoSel] = useState(DEPARTAMENTOS_EL_SALVADOR[0]);
  const rutasDelDepto = rutas.porDepartamento[deptoSel] || [];
  const alternarRutaDepto = (ruta) => {
    setRutas(r => {
      const actual = r.porDepartamento[deptoSel] || [];
      const lista = actual.includes(ruta) ? actual.filter(x => x !== ruta) : [...actual, ruta];
      return { ...r, porDepartamento: { ...r.porDepartamento, [deptoSel]: lista } };
    });
    marcar('rutas');
  };

  // ---------------------------------------------------------------- ÁREAS
  const editarArea = (i, valor) => {
    setAreas(a => {
      const vieja = a.areas[i];
      const codigos = { ...a.codigos };
      if (valor !== vieja && codigos[vieja]) {
        codigos[valor] = codigos[vieja];
        delete codigos[vieja];
      }
      return { ...a, areas: a.areas.map((x, j) => (j === i ? valor : x)), codigos };
    });
    marcar('areas');
  };

  const editarCodigo = (nombre, valor) => {
    setAreas(a => ({ ...a, codigos: { ...a.codigos, [nombre]: valor } }));
    marcar('areas');
  };

  const eliminarArea = async (i, valor) => {
    if (valor === 'General') {
      addToast('"General" es el área por defecto del sistema y no se puede eliminar', 'warning');
      return;
    }
    const confirmado = await confirm({
      title: '¿Eliminar el área?',
      message: `Se quitará "${valor}" del catálogo. Las órdenes guardadas con esa área la conservan en su historial.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!confirmado) return;
    setAreas(a => ({ ...a, areas: a.areas.filter((_, j) => j !== i) }));
    marcar('areas');
  };

  const [nuevaArea, setNuevaArea] = useState('');
  const agregarArea = () => {
    const valor = nuevaArea.trim();
    if (!valor) return;
    if (areas.areas.some(a => a.toLowerCase() === valor.toLowerCase())) {
      addToast('Esa área ya está en el catálogo', 'warning');
      return;
    }
    setAreas(a => ({ ...a, areas: [...a.areas, valor] }));
    setNuevaArea('');
    marcar('areas');
  };

  // --------------------------------------------------------------- TAREAS
  const esReparacion = grupoActual.startsWith('rep:');
  const areaGrupo = esReparacion ? grupoActual.slice(4) : '';
  const filas = useMemo(() => {
    const lista = filasDeGrupo(grupoActual, areaGrupo, tareas);
    const q = busquedaTarea.trim().toLowerCase();
    return q ? lista.filter(f => (f.descripcion || '').toLowerCase().includes(q)) : lista;
  }, [grupoActual, areaGrupo, tareas, busquedaTarea]);

  const cambiarTarea = (fila, campo, valor) => {
    setTareas(prev => {
      const siguiente = { ...prev };
      if (fila.origen === 'base') {
        siguiente.mantenimiento = {
          ...prev.mantenimiento,
          base5000: prev.mantenimiento.base5000.map((t, j) => (j === fila.idx ? { ...t, [campo]: valor } : t)),
        };
      } else if (fila.origen === 'extra') {
        siguiente.mantenimiento = {
          ...prev.mantenimiento,
          extendidas20000: prev.mantenimiento.extendidas20000.map((t, j) => (j === fila.idx ? { ...t, [campo]: valor } : t)),
        };
      } else if (fila.origen === 'empresa') {
        const lista = [...(prev.empresa[areaGrupo] || [])];
        lista[fila.idx] = valor;
        siguiente.empresa = { ...prev.empresa, [areaGrupo]: lista };
      } else {
        siguiente.genericas = prev.genericas.map((t, j) => (j === fila.idx ? { ...t, [campo]: valor } : t));
      }
      return siguiente;
    });
    marcar('tareas');
  };

  const eliminarTarea = async (fila) => {
    const confirmado = await confirm({
      title: '¿Eliminar la tarea?',
      message: `Se quitará "${fila.descripcion}" del catálogo. Las órdenes en curso conservan las actividades que ya tengan cargadas.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!confirmado) return;
    setTareas(prev => {
      const siguiente = { ...prev };
      if (fila.origen === 'base') {
        siguiente.mantenimiento = {
          ...prev.mantenimiento,
          base5000: prev.mantenimiento.base5000.filter((_, j) => j !== fila.idx),
        };
      } else if (fila.origen === 'extra') {
        siguiente.mantenimiento = {
          ...prev.mantenimiento,
          extendidas20000: prev.mantenimiento.extendidas20000.filter((_, j) => j !== fila.idx),
        };
      } else if (fila.origen === 'empresa') {
        const lista = (prev.empresa[areaGrupo] || []).filter((_, j) => j !== fila.idx);
        siguiente.empresa = { ...prev.empresa, [areaGrupo]: lista };
      } else {
        siguiente.genericas = prev.genericas.filter((_, j) => j !== fila.idx);
      }
      return siguiente;
    });
    marcar('tareas');
  };

  const [nuevaTarea, setNuevaTarea] = useState('');
  const [areaNuevaTarea, setAreaNuevaTarea] = useState('Motor');
  const agregarTarea = () => {
    const valor = nuevaTarea.trim();
    if (!valor) return;
    const sello = Date.now().toString(36);
    setTareas(prev => {
      if (esReparacion) {
        const lista = [...(prev.empresa[areaGrupo] || []), valor];
        return { ...prev, empresa: { ...prev.empresa, [areaGrupo]: lista } };
      }
      const tarea = {
        clave: grupoActual === 'mtto5000' ? `mtto5k-nuevo-${sello}` : `mtto20k-nuevo-${sello}`,
        descripcion: valor,
        area: areaNuevaTarea,
        tiempoEstimadoMinutos: 60,
      };
      if (grupoActual === 'mtto5000') {
        return { ...prev, mantenimiento: { ...prev.mantenimiento, base5000: [...prev.mantenimiento.base5000, tarea] } };
      }
      return { ...prev, mantenimiento: { ...prev.mantenimiento, extendidas20000: [...prev.mantenimiento.extendidas20000, tarea] } };
    });
    setNuevaTarea('');
    marcar('tareas');
  };

  // --------------------------------------------------------------- GUARDAR
  const guardar = async () => {
    const pestanaActual = PESTANAS.find(p => p.id === pestana);
    const confirmado = await confirm({
      title: `¿Guardar el catálogo de ${pestanaActual.etiqueta.toLowerCase()}?`,
      message: 'Los cambios se aplican de inmediato en todo el sistema (desplegables, filtros y checklists) y quedan registrados en la bitácora.',
      confirmText: 'Sí, guardar',
      cancelText: 'Cancelar',
    });
    if (!confirmado) return;

    setGuardando(true);
    try {
      const por = currentUser?.nombre || 'Soporte';
      if (pestana === 'rutas') {
        // Los departamentos solo guardan rutas que existan en la lista maestra
        const maestras = rutas.predeterminadas.map(r => r.trim()).filter(Boolean);
        const porDepartamento = Object.fromEntries(
          Object.entries(rutas.porDepartamento)
            .map(([d, lista]) => [d, (Array.isArray(lista) ? lista : []).filter(r => maestras.includes(r))])
            .filter(([, lista]) => lista.length > 0),
        );
        await guardarCatalogoRutas({ predeterminadas: maestras, porDepartamento, por });
      } else if (pestana === 'areas') {
        const lista = areas.areas.map(a => a.trim()).filter(Boolean);
        const codigos = Object.fromEntries(
          lista.map(n => [n, (areas.codigos[n] || '').trim()]),
        );
        await guardarCatalogoAreas({ areas: lista, codigos, por });
      } else {
        await guardarCatalogoTareas({ ...tareas, por });
      }
      addToast(`Catálogo de ${pestanaActual.etiqueta.toLowerCase()} guardado`, 'success');
    } catch (e) {
      console.error('Error guardando el catálogo:', e);
      addToast(e?.message || 'No se pudo guardar el catálogo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const hayCambios = sucio[pestana];
  // Se puede guardar si hay ediciones, o si la base todavía no tiene el
  // catálogo (primer guardado: aún no hay nada que "descartar").
  const puedeGuardar = hayCambios || info.origen !== 'firestore';
  const caja = { background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 12 };

  return (
    <section style={{ ...caja, padding: '18px 18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#2fbf7126', color: '#2fbf71' }}>
          <TbList />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Catálogos del sistema</div>
          <div style={{ fontSize: 11.5, opacity: 0.65 }}>
            Rutas, áreas y tareas · {info.origen === 'firestore' ? 'guardados en la base' : 'valores de respaldo'}
            {info.actualizadoEn ? ` · última edición ${new Date(info.actualizadoEn).toLocaleString('es-SV')}` : ''}
          </div>
        </div>
        {hayCambios && (
          <span className="badge badge-pausado" style={{ fontSize: 10.5 }}>
            <TbAlertCircle size={12} style={{ marginRight: 5, verticalAlign: '-2px' }} />
            Cambios sin guardar
          </span>
        )}
        <button type="button" className="btn btn-sm" onClick={reiniciar} title="Deshacer cambios y volver a leer lo guardado">
          <TbRefresh size={14} /> Descartar
        </button>
        <button type="button" className="btn btn-sm btn-success" onClick={guardar} disabled={guardando || !puedeGuardar}>
          <TbDeviceFloppy size={14} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PESTANAS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`btn btn-sm ${pestana === p.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPestana(p.id)}
          >
            {p.icono} <span style={{ marginLeft: 6 }}>{p.etiqueta}</span>
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- RUTAS */}
      {pestana === 'rutas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              RUTAS ({rutas.predeterminadas.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {rutas.predeterminadas.map((ruta, i) => (
                <div key={`${i}-${ruta}`} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    value={ruta}
                    onChange={e => editarRuta(i, e.target.value)}
                    aria-label={`Ruta ${i + 1}`}
                  />
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarRuta(i, ruta)} title="Eliminar ruta">
                    <TbTrash size={14} />
                  </button>
                </div>
              ))}
              {rutas.predeterminadas.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>No hay rutas en el catálogo.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <input
                className="form-input"
                placeholder="Nueva ruta de camiones…"
                value={nuevaRuta}
                onChange={e => setNuevaRuta(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarRuta(); } }}
              />
              <button type="button" className="btn btn-sm btn-primary" onClick={agregarRuta}>
                <TbPlus size={14} /> Agregar
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>RUTAS VÁLIDAS POR DEPARTAMENTO</div>
            <select
              className="form-select"
              value={deptoSel}
              onChange={e => setDeptoSel(e.target.value)}
              style={{ marginBottom: 10 }}
            >
              {DEPARTAMENTOS_EL_SALVADOR.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 8 }}>
              Solo las rutas marcadas aparecen al asignar zona a una persona en Personal.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {rutas.predeterminadas.map(ruta => {
                const activa = rutasDelDepto.includes(ruta);
                return (
                  <label
                    key={ruta}
                    style={{
                      display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5,
                      padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${activa ? 'rgba(47,191,113,0.45)' : 'var(--color-border)'}`,
                      background: activa ? 'rgba(47,191,113,0.08)' : 'transparent',
                      textTransform: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activa}
                      onChange={() => alternarRutaDepto(ruta)}
                      style={{ marginTop: 2 }}
                    />
                    <span>{ruta}</span>
                  </label>
                );
              })}
              {rutas.predeterminadas.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Agrega rutas primero para asignarlas por departamento.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- ÁREAS */}
      {pestana === 'areas' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            ÁREAS DEL TALLER ({areas.areas.length})
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 10 }}>
            Aparecen en las órdenes, en los filtros de reportes y agrupan las tareas de reparación.
            El código corto es la etiqueta del Dashboard.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
            {areas.areas.map((area, i) => (
              <div key={`${i}-${area}`} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input
                  className="form-input"
                  value={area}
                  onChange={e => editarArea(i, e.target.value)}
                  aria-label={`Área ${i + 1}`}
                  style={{ flex: 1 }}
                />
                <input
                  className="form-input"
                  value={areas.codigos[area] || ''}
                  onChange={e => editarCodigo(area, e.target.value)}
                  placeholder="CÓD."
                  aria-label={`Código de ${area}`}
                  maxLength={5}
                  style={{ width: 84, textAlign: 'center' }}
                />
                <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarArea(i, area)} title="Eliminar área">
                  <TbTrash size={14} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
            <input
              className="form-input"
              placeholder="Nueva área del taller…"
              value={nuevaArea}
              onChange={e => setNuevaArea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarArea(); } }}
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={agregarArea}>
              <TbPlus size={14} /> Agregar
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- TAREAS */}
      {pestana === 'tareas' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <select
              className="form-select"
              value={grupoActual}
              onChange={e => { setGrupoSel(e.target.value); setBusquedaTarea(''); }}
              style={{ minWidth: 240 }}
            >
              {grupos.map(g => <option key={g.id} value={g.id}>{g.etiqueta}</option>)}
            </select>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: 200 }}>
              <TbSearch size={15} />
              <input
                placeholder="Buscar tarea…"
                value={busquedaTarea}
                onChange={e => setBusquedaTarea(e.target.value)}
              />
            </div>
          </div>

          <div style={{ fontSize: 11.5, opacity: 0.65, marginBottom: 8 }}>
            {esReparacion
              ? `Tareas precargadas para el área ${areaGrupo}. Se cargan al elegir "Fallas o daños" en una orden.`
              : 'Tareas del servicio preventivo. El de 20,000 km siempre incluye las del de 5,000 km.'}
            {' '}Total: {filas.length}.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 330, overflowY: 'auto', paddingRight: 4 }}>
            {filas.map((fila) => (
              <div key={`${fila.origen}-${fila.idx}-${fila.clave}`} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input
                  className="form-input"
                  value={fila.descripcion || ''}
                  onChange={e => cambiarTarea(fila, 'descripcion', e.target.value)}
                  aria-label="Descripción de la tarea"
                />
                {!esReparacion && (
                  <select
                    className="form-select"
                    value={fila.area || 'General'}
                    onChange={e => cambiarTarea(fila, 'area', e.target.value)}
                    aria-label="Área de la tarea"
                    style={{ width: 165 }}
                  >
                    {AREAS_TRABAJO.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="5"
                  value={fila.tiempoEstimadoMinutos ?? 60}
                  onChange={e => cambiarTarea(fila, 'tiempoEstimadoMinutos', Number(e.target.value))}
                  aria-label="Tiempo estimado en minutos"
                  title="Tiempo estimado (minutos)"
                  style={{ width: 78, textAlign: 'center' }}
                />
                <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarTarea(fila)} title="Eliminar tarea">
                  <TbTrash size={14} />
                </button>
              </div>
            ))}
            {filas.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>No hay tareas en este grupo.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              placeholder="Nueva tarea…"
              value={nuevaTarea}
              onChange={e => setNuevaTarea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarTarea(); } }}
              style={{ flex: 1, minWidth: 200 }}
            />
            {!esReparacion && (
              <select
                className="form-select"
                value={areaNuevaTarea}
                onChange={e => setAreaNuevaTarea(e.target.value)}
                style={{ width: 165 }}
                aria-label="Área de la tarea nueva"
              >
                {AREAS_TRABAJO.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={agregarTarea}>
              <TbPlus size={14} /> Agregar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
