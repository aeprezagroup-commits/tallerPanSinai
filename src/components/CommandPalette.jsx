import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TbSearch, TbTruck, TbTools, TbCirclePlus, TbList,
  TbCircleCheck, TbShieldCheck, TbCornerDownLeft, TbX,
  TbChartBar, TbStack2, TbReportMoney, TbUsers
} from '../icons';
import { obtenerFlotaVehiculos } from '../services/vehiculosService';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import { filtrarOrdenesPorUsuario, visiblesParaTaller } from '../services/permisosService';
import { useAuth } from '../context/AuthContext';
import ModalPortal from './ModalPortal';
import { VERSION } from '../version';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [ordenes, setOrdenes] = useState([]);
  const [flota, setFlota] = useState(obtenerFlotaVehiculos);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser, isAdmin, isMecanico } = useAuth();

  useEffect(() => {
    const unsub = escucharOrdenes((data) => setOrdenes(data));
    const handleVehiclesUpdate = () => setFlota(obtenerFlotaVehiculos());
    window.addEventListener('pan_sinai_vehicles_updated', handleVehiclesUpdate);
    return () => {
      unsub();
      window.removeEventListener('pan_sinai_vehicles_updated', handleVehiclesUpdate);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const staticActions = [
    { id: 'act-new', titulo: 'Recepción e Ingreso de Vehículo', subtitulo: 'Módulo de Recepción EST-01', icono: <TbCirclePlus />, path: '/nueva-orden' },
    ...(!isMecanico ? [{ id: 'act-bays', titulo: 'Vehículos en Taller', subtitulo: 'Área de reparación EST-02', icono: <TbTools />, path: '/taller' }] : []),
    { id: 'act-orders', titulo: isMecanico ? 'Mis Órdenes de Trabajo' : 'Órdenes de Trabajo', subtitulo: 'Supervisión y control de actividades EST-03', icono: <TbList />, path: '/ordenes' },
    { id: 'act-out', titulo: 'Inspección de Despacho y Salida', subtitulo: 'Cierre y entrega de vehículos EST-04', icono: <TbCircleCheck />, path: '/salida' },
    { id: 'act-vehicle', titulo: 'Consulta de Estado de Unidad', subtitulo: 'Buscar unidad por placa, marca o VIN', icono: <TbSearch />, path: '/vehiculo' },
    ...(isAdmin ? [
      { id: 'act-admin', titulo: 'Panel de Administración', subtitulo: 'Hub de módulos: reportes, vehículos, personal, gastos e historial', icono: <TbShieldCheck />, path: '/admin' },
      { id: 'act-dash', titulo: 'Reportes', subtitulo: 'Métricas ejecutivas: costos, productividad y flota + exportación CSV', icono: <TbChartBar />, path: '/admin/reportes' },
      { id: 'act-flota', titulo: 'Vehículos (Flota)', subtitulo: 'Catálogo de unidades, códigos QR y carga masiva por CSV', icono: <TbTruck />, path: '/admin/vehiculos' },
      { id: 'act-personal', titulo: 'Personal y Accesos', subtitulo: 'Usuarios, mecánicos, roles y contraseñas', icono: <TbUsers />, path: '/admin/personal' },
      { id: 'act-gastos', titulo: 'Gastos por Vehículo', subtitulo: 'Registro de facturas, vales y centros de costo', icono: <TbReportMoney />, path: '/admin/gastos' },
      { id: 'act-hist', titulo: 'Historial & Auditoría', subtitulo: 'Registro histórico de órdenes, estados y justificaciones', icono: <TbStack2 />, path: '/admin/historial' }
    ] : [])
  ];

  const q = query.trim().toLowerCase();

  const ordenesVisibles = isMecanico ? visiblesParaTaller(ordenes, currentUser) : filtrarOrdenesPorUsuario(ordenes, currentUser);

  const resultadosOrdenes = ordenesVisibles
    .filter(o =>
      !q ||
      o.placa?.toLowerCase().includes(q) ||
      o.conductorEntrega?.toLowerCase().includes(q) ||
      o.marca?.toLowerCase().includes(q) ||
      o.modelo?.toLowerCase().includes(q) ||
      o.mecanicoAsignado?.toLowerCase().includes(q) ||
      formatoOT(o).toLowerCase().includes(q) ||
      (q.replace(/\D/g, '') !== '' && String(o.numeroOrden || '') === q.replace(/\D/g, ''))
    )
    .slice(0, 5)
    .map(o => ({
      id: `ord-${o.id}`,
      titulo: `${formatoOT(o)} • ${o.placa} • ${o.marca} ${o.modelo}`,
      subtitulo: `Estado: ${o.estado?.toUpperCase()} | Asignado: ${o.mecanicoAsignado || 'Sin asignar'} | Conductor: ${o.conductorEntrega || '—'}`,
      icono: <TbTruck style={{ color: 'var(--color-accent)' }} />,
      tipo: 'orden',
      item: o
    }));

  const resultadosFlota = flota
    .filter(v =>
      q &&
      (v.placa.toLowerCase().includes(q) ||
       v.marca.toLowerCase().includes(q) ||
       v.modelo.toLowerCase().includes(q) ||
       v.conductorHabitual?.toLowerCase().includes(q))
    )
    .slice(0, 4)
    .map(v => ({
      id: `flota-${v.placa}`,
      titulo: `Catálogo Flota: ${v.placa} - ${v.marca} ${v.modelo}`,
      subtitulo: `Tipo: ${v.tipo} | Conductor Habitual: ${v.conductorHabitual || '—'}`,
      icono: <TbTruck style={{ color: '#38bdf8' }} />,
      tipo: 'vehiculo',
      item: v
    }));

  const resultadosAcciones = staticActions.filter(a =>
    !q || a.titulo.toLowerCase().includes(q) || a.subtitulo.toLowerCase().includes(q)
  );

  const todosResultados = [
    ...resultadosAcciones,
    ...resultadosOrdenes,
    ...resultadosFlota
  ];

  const handleSelect = (item) => {
    if (!item) return;
    onClose();
    if (item.path) {
      navigate(item.path);
    } else if (item.tipo === 'orden') {
      navigate(`/ordenes/${item.item.id}`);
    } else if (item.tipo === 'vehiculo') {
      navigate(`/nueva-orden?placa=${item.item.placa}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (todosResultados.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + todosResultados.length) % (todosResultados.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (todosResultados[selectedIndex]) {
        handleSelect(todosResultados[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="modal-overlay command-palette-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
        <div
          className="command-palette-modal"
          onClick={e => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div className="command-palette-input-wrap">
            <TbSearch className="command-palette-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="command-palette-input"
              placeholder="Buscar placas, conductores, órdenes de trabajo, módulos..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
            />
            <span className="command-palette-badge">ESC para salir</span>
            <button type="button" className="command-palette-close" onClick={onClose}>
              <TbX />
            </button>
          </div>

          <div className="command-palette-list">
            {todosResultados.length === 0 ? (
              <div className="command-palette-empty">
                No se encontraron coincidencias para "<strong>{query}</strong>"
              </div>
            ) : (
              todosResultados.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="command-palette-item-icon">
                      {item.icono}
                    </div>
                    <div className="command-palette-item-text">
                      <div className="command-palette-item-title">{item.titulo}</div>
                      <div className="command-palette-item-sub">{item.subtitulo}</div>
                    </div>
                    {isSelected && (
                      <div className="command-palette-item-enter">
                        <TbCornerDownLeft />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="command-palette-footer">
            <div style={{ display: 'flex', gap: 14 }}>
              <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
              <span><kbd>↵</kbd> Seleccionar</span>
              <span><kbd>ESC</kbd> Cerrar</span>
            </div>
            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
              PAN SINAÍ TELEMATICS v{VERSION}
            </span>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
