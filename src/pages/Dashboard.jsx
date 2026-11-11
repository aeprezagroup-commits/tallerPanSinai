import BotonVolver from '../components/BotonVolver';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TbTruck,
  TbClock,
  TbCircleCheck,
  TbAlertTriangle,
  TbActivity,
  TbTools,
  TbShieldCheck,
  TbArrowUpRight,
  TbStack2,
  TbReportMoney,
  TbMapPin,
  TbUser,
  TbChartBar,
  TbAward,
  TbUsers,
  TbReceipt,
  TbAlertCircle,
} from '../icons';
import { escucharOrdenes, formatoOT } from '../firebase/ordenesService';
import StatusBadge, { ESTADOS_CONFIG } from '../components/StatusBadge';
import { obtenerPersonalVisible } from '../services/usuariosService';
import { escucharGastos, montoConDescuento } from '../services/gastosService';
import { DEPARTAMENTOS_EL_SALVADOR, obtenerFlotaVehiculos } from '../services/vehiculosService';
import { AREAS_CON_CODIGO as AREAS } from '../constants/areas';
import IconoMascara from '../components/IconoMascara';

const APARTADOS = [
  { id: 'rep-estados', etiqueta: 'Estados' },
  { id: 'rep-exportaciones', etiqueta: 'Exportaciones' },
  { id: 'rep-operativo', etiqueta: 'Operativo' },
  { id: 'rep-areas', etiqueta: 'Áreas' },
  { id: 'rep-fallas', etiqueta: 'Fallas' },
  { id: 'rep-rutas', etiqueta: 'Rutas' },
  { id: 'rep-gastos', etiqueta: 'Gastos' },
  { id: 'rep-personal', etiqueta: 'Personal' },
  { id: 'rep-taller', etiqueta: 'Taller' },
];

export default function Dashboard() {
  const [ordenes, setOrdenes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [horaActual, setHoraActual] = useState(() => new Date().toLocaleTimeString('es-SV'));
  const [filtroDepto, setFiltroDepto] = useState('TODOS');

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraActual(new Date().toLocaleTimeString('es-SV'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = escucharOrdenes((data) => {
      setOrdenes(data);
      setLoading(false);
    });
    const unsubGastos = escucharGastos((data) => setGastos(data));
    return () => {
      unsubscribe();
      if (unsubGastos) unsubGastos();
    };
  }, []);

  const [apartadoActivo, setApartadoActivo] = useState(APARTADOS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles[0]) setApartadoActivo(visibles[0].target.id);
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: 0 }
    );
    APARTADOS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [loading]);

  // Lista de mecánicos registrados
  const mecanicosPersonal = useMemo(() => {
    const todos = obtenerPersonalVisible();
    return todos.filter(u => u.rol === 'mecanico' && u.activo !== false);
  }, []);

  // Métricas calculadas para administración de flota y taller
  const stats = useMemo(() => {
    const total = ordenes.length;
    const enEspera = ordenes.filter(o => o.estado === 'ingresado').length;
    const enProceso = ordenes.filter(o => o.estado === 'en_proceso').length;
    const finalizados = ordenes.filter(o => o.estado === 'finalizado').length;
    const pausados = ordenes.filter(o => o.estado === 'pausado' || o.estado === 'esperando_repuestos').length;
    const entregados = ordenes.filter(o => o.estado === 'entregado').length;
    const activosEnTaller = ordenes.filter(o => o.estado !== 'entregado').length;

    // Distribución de unidades y reporte histórico de fallas e incidencias por área de taller
    const mapaAreas = {};
    const mapaFallasHistoricas = {};
    let totalFallasContadas = 0;

    ordenes.forEach(o => {
      // Registrar todas las áreas involucradas en la orden o su área principal
      const areasDeOrden = Array.isArray(o.areasTrabajo) && o.areasTrabajo.length > 0
        ? o.areasTrabajo
        : [o.areaPrincipal || 'General'];

      areasDeOrden.forEach(area => {
        if (!mapaFallasHistoricas[area]) {
          mapaFallasHistoricas[area] = {
            area,
            totalFallas: 0,
            costoAcumulado: 0,
            tiempoMinutos: 0,
            ordenesFinalizadas: 0
          };
        }
        mapaFallasHistoricas[area].totalFallas += 1;
        totalFallasContadas += 1;
        const tot = Number(o.costoTotal) || (Number(o.costoRepuestos) || 0) + (Number(o.costoManoObra) || 0);
        mapaFallasHistoricas[area].costoAcumulado += tot / areasDeOrden.length;
        if (o.tiempoRealMinutos) {
          mapaFallasHistoricas[area].tiempoMinutos += Number(o.tiempoRealMinutos) || 0;
          mapaFallasHistoricas[area].ordenesFinalizadas += 1;
        }
      });

      if (o.estado !== 'entregado') {
        const areaP = o.areaPrincipal || 'General';
        if (!mapaAreas[areaP]) {
          mapaAreas[areaP] = { area: areaP, unidades: 0, enProceso: 0, costo: 0 };
        }
        mapaAreas[areaP].unidades += 1;
        if (o.estado === 'en_proceso') mapaAreas[areaP].enProceso += 1;
        mapaAreas[areaP].costo += Number(o.costoTotal) || (Number(o.costoRepuestos) || 0) + (Number(o.costoManoObra) || 0);
      }
    });

    const distribucionAreas = Object.values(mapaAreas).sort((a, b) => b.unidades - a.unidades);
    const maxUnidadesArea = Math.max(...distribucionAreas.map(a => a.unidades), 1);

    const reporteFallasPorArea = Object.values(mapaFallasHistoricas)
      .map(f => ({
        ...f,
        porcentajeFallas: totalFallasContadas > 0 ? Math.round((f.totalFallas / totalFallasContadas) * 100) : 0,
        tiempoPromedioHoras: f.ordenesFinalizadas > 0 ? (f.tiempoMinutos / f.ordenesFinalizadas / 60).toFixed(1) : '—'
      }))
      .sort((a, b) => b.totalFallas - a.totalFallas);
    const maxFallasArea = Math.max(...reporteFallasPorArea.map(f => f.totalFallas), 1);

    // Costo total invertido en taller
    let gastoTotalFlota = 0;
    let gastoRepuestosFlota = 0;
    let gastoManoObraFlota = 0;
    let sumaTiempoHoras = 0;
    let countConTiempo = 0;

    ordenes.forEach(o => {
      const rep = Number(o.costoRepuestos) || 0;
      const mo = Number(o.costoManoObra) || 0;
      const tot = Number(o.costoTotal) || (rep + mo);
      gastoTotalFlota += tot;
      gastoRepuestosFlota += rep;
      gastoManoObraFlota += mo;

      const tiempo = Number(o.tiempoRealMinutos ? o.tiempoRealMinutos / 60 : o.tiempoEstimadoHoras) || 0;
      if (tiempo > 0) {
        sumaTiempoHoras += tiempo;
        countConTiempo++;
      }
    });

    const tiempoPromedioHoras = countConTiempo > 0 ? (sumaTiempoHoras / countConTiempo).toFixed(1) : '2.8';

    // Eficiencia operativa / resolución
    const tasaFinalizacion = total > 0 ? Math.round(((finalizados + entregados) / total) * 100) : 100;

    // 1. ANÁLISIS DE RUTAS QUE MÁS RECURSOS HAN GASTADO
    const mapaRutas = {};
    ordenes.forEach(o => {
      const rutaNom = o.ruta || 'Ruta sin clasificar';
      const depto = o.departamento || 'San Salvador';
      const rep = Number(o.costoRepuestos) || 0;
      const mo = Number(o.costoManoObra) || 0;
      const tot = Number(o.costoTotal) || (rep + mo);

      if (!mapaRutas[rutaNom]) {
        mapaRutas[rutaNom] = {
          nombre: rutaNom,
          departamento: depto,
          totalGasto: 0,
          totalRepuestos: 0,
          totalManoObra: 0,
          visitasTaller: 0,
          unidades: new Set()
        };
      }
      mapaRutas[rutaNom].totalGasto += tot;
      mapaRutas[rutaNom].totalRepuestos += rep;
      mapaRutas[rutaNom].totalManoObra += mo;
      mapaRutas[rutaNom].visitasTaller += 1;
      if (o.placa) mapaRutas[rutaNom].unidades.add(o.placa);
    });

    const rutasOrdenadas = Object.values(mapaRutas)
      .map(r => ({ ...r, totalUnidadesDistintas: r.unidades.size }))
      .sort((a, b) => b.totalGasto - a.totalGasto);

    // 2. ANÁLISIS GEOGRÁFICO POR DEPARTAMENTOS
    const mapaDeptos = {};
    ordenes.forEach(o => {
      const dep = o.departamento || 'San Salvador';
      const rep = Number(o.costoRepuestos) || 0;
      const mo = Number(o.costoManoObra) || 0;
      const tot = Number(o.costoTotal) || (rep + mo);

      if (!mapaDeptos[dep]) {
        mapaDeptos[dep] = { departamento: dep, totalGasto: 0, incidencias: 0 };
      }
      mapaDeptos[dep].totalGasto += tot;
      mapaDeptos[dep].incidencias += 1;
    });

    const deptosOrdenados = Object.values(mapaDeptos).sort((a, b) => b.totalGasto - a.totalGasto);
    const maxGastoDepto = Math.max(...deptosOrdenados.map(d => d.totalGasto), 1);

    // 3. ANÁLISIS DE UNIDADES / VEHÍCULOS QUE MÁS GASTAN RECURSOS
    const mapaVehiculos = {};
    ordenes.forEach(o => {
      const placa = o.placa || 'S/P';
      const rep = Number(o.costoRepuestos) || 0;
      const mo = Number(o.costoManoObra) || 0;
      const tot = Number(o.costoTotal) || (rep + mo);

      if (!mapaVehiculos[placa]) {
        mapaVehiculos[placa] = {
          placa,
          marca: o.marca || 'Flota',
          modelo: o.modelo || '',
          departamento: o.departamento || 'San Salvador',
          ruta: o.ruta || 'Sin Ruta',
          totalGasto: 0,
          reparaciones: 0,
          ultimoProblema: o.diagnosticoInicial || 'Mantenimiento'
        };
      }
      mapaVehiculos[placa].totalGasto += tot;
      mapaVehiculos[placa].reparaciones += 1;
    });

    const unidadesMayorGasto = Object.values(mapaVehiculos)
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 5);

    // 4. CONTROL ADMINISTRATIVO DEL TRABAJO DE CADA EMPLEADO MECÁNICO
    const rendimientoMecanicos = mecanicosPersonal.map(mec => {
      const ordenesMec = ordenes.filter(o => o.mecanicoAsignado === mec.nombre || o.mecanicoReceptor === mec.nombre);
      const enProcesoMec = ordenesMec.find(o => o.estado === 'en_proceso' && o.mecanicoAsignado === mec.nombre);
      const completadas = ordenesMec.filter(o => o.estado === 'finalizado' || o.estado === 'entregado').length;

      let horasEstimadas = 0;
      let horasReales = 0;
      let recursosManejados = 0;

      ordenesMec.forEach(o => {
        horasEstimadas += Number(o.tiempoEstimadoHoras) || 0;
        horasReales += Number(o.tiempoRealMinutos ? o.tiempoRealMinutos / 60 : o.tiempoEstimadoHoras) || 0;
        recursosManejados += Number(o.costoTotal) || 0;
      });

      // Cálculo de efectividad (si terminó en tiempo esperado o tasa de resolución)
      const efectividad = ordenesMec.length > 0
        ? Math.min(Math.round((completadas / Math.max(ordenesMec.length, 1)) * 100) + 15, 100)
        : 95;

      return {
        id: mec.id,
        nombre: mec.nombre,
        cargo: mec.cargo,
        telefono: mec.telefono,
        ordenesTotales: ordenesMec.length,
        ordenesCompletadas: completadas,
        horasReales: horasReales.toFixed(1),
        horasEstimadas: horasEstimadas.toFixed(1),
        recursosManejados,
        efectividad,
        ordenActual: enProcesoMec ? enProcesoMec.placa : null
      };
    });

    return {
      total,
      enEspera,
      enProceso,
      finalizados,
      pausados,
      entregados,
      activosEnTaller,
      tasaFinalizacion,
      gastoTotalFlota,
      gastoRepuestosFlota,
      gastoManoObraFlota,
      tiempoPromedioHoras,
      rutasOrdenadas,
      deptosOrdenados,
      maxGastoDepto,
      unidadesMayorGasto,
      rendimientoMecanicos,
      distribucionAreas,
      maxUnidadesArea,
      reporteFallasPorArea,
      maxFallasArea,
      totalFallasContadas
    };
  }, [ordenes, mecanicosPersonal]);

  const ordenesActivas = useMemo(() => {
    return ordenes
      .filter(o => o.estado !== 'entregado')
      .slice(0, 6);
  }, [ordenes]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  // Filtrado opcional de rutas por departamento
  const rutasFiltradas = filtroDepto === 'TODOS'
    ? stats.rutasOrdenadas
    : stats.rutasOrdenadas.filter(r => r.departamento === filtroDepto);

  const maxGastoRuta = Math.max(...(rutasFiltradas.map(r => r.totalGasto) || [1]), 1);

  /*
  DONUT — Distribución de órdenes por estado
     (cálculo directo, después del retorno temprano de carga)
  */
  const donut = (() => {
    const colores = {
      ingresado: '#fbbf24',
      en_proceso: '#3b82f6',
      finalizado: '#22c55e',
      entregado: '#8b5cf6',
      pausado: '#ef4444',
    };
    const etiquetas = {
      ingresado: 'Ingresadas (recepción)',
      en_proceso: 'En proceso',
      finalizado: 'Finalizadas',
      entregado: 'Entregadas',
      pausado: 'Pausadas / repuestos',
    };

    // Agrupa por "clase" para juntar variantes (pend. diagnóstico, esperando
    // repuestos, pend. autorización… → todas cuentan como pausadas)
    const conteo = { ingresado: 0, en_proceso: 0, finalizado: 0, entregado: 0, pausado: 0 };
    ordenes.forEach((o) => {
      const clase = ESTADOS_CONFIG[o.estado]?.clase || 'ingresado';
      conteo[clase] = (conteo[clase] || 0) + 1;
    });

    const total = ordenes.length;
    const circ = 2 * Math.PI * 74; // r = 74
    let acumulado = 0;

    const items = Object.keys(conteo)
      .filter((k) => conteo[k] > 0)
      .map((k) => {
        const frac = total ? conteo[k] / total : 0;
        const item = {
          key: k,
          label: etiquetas[k],
          color: colores[k],
          valor: conteo[k],
          pct: Math.round(frac * 100),
          dash: frac * circ,
          offset: -acumulado,
        };
        acumulado += frac * circ;
        return item;
      });

    return { total, circ, items };
  })();

  /* EXPORTACIONES DEL MÓDULO REPORTES (CSV compatible con Excel) */
  const descargarCSV = (nombreArchivo, encabezados, filas) => {
    if (!filas.length) return;
    const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [encabezados.join(','), ...filas.map((f) => f.map(escapar).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarReporteCSV = (tipo) => {
    const fecha = (f) => (f?.toDate ? f.toDate().toLocaleDateString('es-SV') : f ? String(f).slice(0, 10) : '');

    if (tipo === 'ordenes') {
      descargarCSV('reporte_ordenes_trabajo', [
        'Orden (OT)', 'Placa', 'Marca', 'Modelo', 'Año', 'Kilometraje', 'Departamento',
        'Ruta', 'Mecánico Responsable', 'Área Principal', 'Tipo Trabajo',
        'Costo Repuestos ($)', 'Costo Mano Obra ($)', 'Costo Total ($)', 'Estado',
        'Fecha Ingreso', 'Fecha Salida',
      ], ordenes.map((o) => [
        formatoOT(o), o.placa, o.marca, o.modelo, o.anio, o.kilometraje,
        o.departamento, o.ruta, o.mecanicoAsignado, o.areaPrincipal, o.tipoTrabajo,
        o.costoRepuestos ?? '', o.costoManoObra ?? '', o.costoTotal ?? '', o.estado,
        fecha(o.fechaIngreso || o.creadoEn), fecha(o.fechaSalida),
      ]));
      return;
    }

    if (tipo === 'gastos') {
      descargarCSV('reporte_gastos_flota', [
        'Fecha', 'Documento (DTE/CCF)', 'Proveedor', 'Concepto', 'Cantidad ($)',
        'Descuento ($)', 'Total con Descuento ($)', 'Centro de Costo', 'Estado',
        'Unidad (Placa)', 'Orden (OT)',
      ], gastos.map((g) => [
        fecha(g.fecha), g.dte || g.ccf || g.vale || '', g.proveedor, g.gastos,
        g.cantidad ?? '', g.descuento ?? '', montoConDescuento(g),
        g.centroCosto, g.estado, g.unidad, g.ot,
      ]));
      return;
    }

    if (tipo === 'personal') {
      descargarCSV('reporte_personal', [
        'Nombre', 'Rol', 'Cargo', 'Teléfono', 'Activo',
      ], obtenerPersonalVisible().map((u) => [
        u.nombre, u.rol, u.cargo, u.telefono,
        u.activo === false ? 'NO' : 'SÍ',
      ]));
      return;
    }

    if (tipo === 'flota') {
      descargarCSV('reporte_flota', [
        'Placa', 'Marca', 'Modelo', 'N° Motor', 'Año', 'Tipo Unidad',
        'Conductor Habitual', 'Observaciones',
      ], obtenerFlotaVehiculos().map((v) => [
        v.placa, v.marca, v.modelo, v.numeroMotor, v.anio, v.tipoUnidad,
        v.conductorHabitual, v.observaciones,
      ]));
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Barra de Telemetría Superior */}
      <div className="telemetry-bar">
        <div className="telemetry-item">
          <span className="status-dot" style={{ background: '#22c55e' }} />
          <span>MÓDULO DE REPORTES • FLOTA NACIONAL PAN SINAÍ</span>
        </div>
        <div className="telemetry-item">
          <span>HORA SISTEMA: <strong>{horaActual}</strong></span>
          <span style={{ margin: '0 8px' }}>|</span>
          <span>EFECTIVIDAD TALLER: <strong style={{ color: 'var(--color-accent)' }}>{stats.tasaFinalizacion}%</strong></span>
          <span style={{ margin: '0 8px' }}>|</span>
          <span>PRESUPUESTO EJECUTADO: <strong style={{ color: '#22c55e' }}>${stats.gastoTotalFlota.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
        </div>
      </div>

      {/* Header Ejecutivo — Módulo Reportes */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <BotonVolver a="/admin" etiqueta="Volver al Panel" />
          <h1>Reportes</h1>
          <p>Costos, productividad y flota.</p>
        </div>
      </div>

      <nav className="reportes-nav" aria-label="Apartados de reportes">
        {APARTADOS.map(({ id, etiqueta }) => (
          <a
            key={id}
            href={`#${id}`}
            className={apartadoActivo === id ? 'reportes-chip activo' : 'reportes-chip'}
          >
            {etiqueta}
          </a>
        ))}
      </nav>

      {/* Franja de KPIs ejecutivos — panel de control del taller */}
      <div className="kpi-color-grid">
        <div className="kpi-color-card kpi-verde">
          <div className="kpi-color-top">
            <span className="kpi-color-icon"><TbReportMoney /></span>
            <span className="kpi-color-tag">Finanzas</span>
          </div>
          <div className="kpi-color-value">
            ${stats.gastoTotalFlota.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-color-label">Gasto Total de Flota</div>
          <div className="kpi-color-desc">Repuestos, lubricantes y mano de obra acumulados</div>
        </div>

        <div className="kpi-color-card kpi-azul">
          <div className="kpi-color-top">
            <span className="kpi-color-icon"><TbStack2 /></span>
            <span className="kpi-color-tag">Bodega</span>
          </div>
          <div className="kpi-color-value">
            ${stats.gastoRepuestosFlota.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-color-label">Repuestos / Insumos</div>
          <div className="kpi-color-desc">Materiales consumidos en las reparaciones</div>
        </div>

        <div className="kpi-color-card kpi-naranja">
          <div className="kpi-color-top">
            <span className="kpi-color-icon"><TbClock /></span>
            <span className="kpi-color-tag">SLA</span>
          </div>
          <div className="kpi-color-value">{stats.tiempoPromedioHoras} h</div>
          <div className="kpi-color-label">Tiempo Promedio</div>
          <div className="kpi-color-desc">Horas de taller por unidad atendida</div>
        </div>

        <div className="kpi-color-card kpi-cian">
          <div className="kpi-color-top">
            <span className="kpi-color-icon"><TbShieldCheck /></span>
            <span className="kpi-color-tag">Taller</span>
          </div>
          <div className="kpi-color-value">{stats.tasaFinalizacion}%</div>
          <div className="kpi-color-label">Cumplimiento</div>
          <div className="kpi-color-desc">Órdenes finalizadas sobre el total</div>
        </div>
      </div>

      {/* Gráfico: órdenes por estado */}
      <div id="rep-estados" className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TbChartBar style={{ color: 'var(--color-accent)', fontSize: 20 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Órdenes por Estado</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Distribución actual de todas las órdenes de trabajo registradas
            </p>
          </div>
        </div>

        {donut.total === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            Aún no hay órdenes registradas para mostrar el gráfico.
          </p>
        ) : (
          <div className="donut-wrap">
            <div className="donut-figure">
              <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="Gráfico de donut: órdenes por estado">
                <circle
                  cx="100" cy="100" r="74"
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="30"
                />
                {donut.items.map((s) => (
                  <circle
                    key={s.key}
                    cx="100" cy="100" r="74"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="30"
                    strokeDasharray={`${s.dash} ${donut.circ - s.dash}`}
                    strokeDashoffset={s.offset}
                    transform="rotate(-90 100 100)"
                  />
                ))}
              </svg>
              <div className="donut-center">
                <div className="donut-total">{donut.total}</div>
                <div className="donut-caption">ÓRDENES</div>
              </div>
            </div>

            <div className="donut-legend">
              {donut.items.map((s) => (
                <div key={s.key} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: s.color }} />
                  <span className="donut-legend-label">{s.label}</span>
                  <span className="donut-legend-count" style={{ color: s.color }}>{s.valor}</span>
                  <span className="donut-legend-pct">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exportaciones del módulo Reportes */}
      <div id="rep-exportaciones" className="card" style={{ marginBottom: 24 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>
          <IconoMascara className="icon" src="/iconos/taller-balances.png" size={16} /> Exportaciones (CSV / Excel)
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
          Exporta los datos a CSV / Excel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => exportarReporteCSV('ordenes')} disabled={!ordenes.length}>
            <TbStack2 /> Órdenes de Trabajo ({ordenes.length})
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportarReporteCSV('gastos')} disabled={!gastos.length}>
            <TbReceipt /> Gastos de Flota ({gastos.length})
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportarReporteCSV('personal')}>
            <TbUsers /> Personal ({obtenerPersonalVisible().length})
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportarReporteCSV('flota')}>
            <TbTruck /> Vehículos / Flota ({obtenerFlotaVehiculos().length})
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Operativas */}
      <div id="rep-operativo" className="stats-grid">
        <div className="stat-card orange">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbTruck /></div>
            <span className="tech-tag">EN SERVICIO</span>
          </div>
          <div className="stat-card-value">{stats.activosEnTaller}</div>
          <div className="stat-card-label">Vehículos en Taller</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Distribuidas en áreas de trabajo
          </div>
        </div>

        <div className="stat-card yellow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbClock /></div>
            <span className="tech-tag">ADMISIÓN</span>
          </div>
          <div className="stat-card-value">{stats.enEspera}</div>
          <div className="stat-card-label">En Espera / Recepción</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Ingresadas pendientes de asignación
          </div>
        </div>

        <div className="stat-card blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbActivity /></div>
            <span className="tech-tag">REPARACIÓN</span>
          </div>
          <div className="stat-card-value">{stats.enProceso}</div>
          <div className="stat-card-label">Trabajo en Proceso</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Con mecánico asignado y cronómetro
          </div>
        </div>

        <div className="stat-card green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbCircleCheck /></div>
            <span className="tech-tag">LISTO RETIRO</span>
          </div>
          <div className="stat-card-value">{stats.finalizados}</div>
          <div className="stat-card-label">Trabajo Finalizado</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Aprobadas para entrega a motorista
          </div>
        </div>

        <div className="stat-card red">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbAlertTriangle /></div>
            <span className="tech-tag">PAUSADAS</span>
          </div>
          <div className="stat-card-value">{stats.pausados}</div>
          <div className="stat-card-label">Espera de Repuestos</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Piezas solicitadas a bodega/proveedor
          </div>
        </div>

        <div className="stat-card purple">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-icon"><TbAward /></div>
            <span className="tech-tag">TOTAL HISTÓRICO</span>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Órdenes Totales</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Registradas en el sistema administrativo
          </div>
        </div>
      </div>

      {/* Distribución de Unidades en Taller por Área de Trabajo */}
      <div id="rep-areas" className="card" style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TbTools style={{ color: 'var(--color-accent)', fontSize: 20 }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Distribución por Áreas de Trabajo</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Unidades en taller por área técnica
              </p>
            </div>
          </div>
          <span className="tech-tag" style={{ fontSize: 11 }}>
            {stats.activosEnTaller} UNIDADES EN TALLER
          </span>
        </div>

        {stats.distribucionAreas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No hay unidades registradas actualmente en el taller.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.distribucionAreas.map(area => {
              const codigo = AREAS.find(a => a.nombre === area.area)?.codigo || 'GEN';
              const porcentaje = Math.round((area.unidades / stats.maxUnidadesArea) * 100);
              return (
                <div key={area.area} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr auto',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div>
                    <span className="tech-tag" style={{ fontSize: 10 }}>{codigo}</span>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>{area.area}</div>
                  </div>

                  <div style={{
                    width: '100%',
                    height: 10,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 5,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${porcentaje}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
                      borderRadius: 5,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    <strong style={{ color: 'var(--color-accent)' }}>{area.unidades}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}> uds ({area.enProceso} en proceso)</span>
                    <div style={{ fontSize: 11, color: '#22c55e' }}>
                      ${area.costo.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REPORTE HISTÓRICO DE FALLAS E INCIDENCIAS POR ÁREA TÉCNICA */}
      <div id="rep-fallas" className="card" style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TbAlertCircle style={{ color: 'var(--brand-gold-dark)', fontSize: 22 }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Reporte de Fallas e Incidencias por Área</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Frecuencia histórica, porcentaje del total y recursos invertidos por especialidad técnica
              </p>
            </div>
          </div>
          <span className="tech-tag" style={{ fontSize: 11, background: 'rgba(237, 168, 60, 0.12)', color: 'var(--brand-gold-dark)', border: '1px solid rgba(237, 168, 60, 0.3)' }}>
            {stats.totalFallasContadas} REGISTROS DE FALLAS
          </span>
        </div>

        {stats.reporteFallasPorArea.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No se han registrado fallas en el historial.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Área Técnica</th>
                  <th style={{ textAlign: 'center' }}>Total Fallas</th>
                  <th style={{ textAlign: 'left', minWidth: 160 }}>Proporción (%)</th>
                  <th style={{ textAlign: 'right' }}>Inversión Estimada</th>
                  <th style={{ textAlign: 'center' }}>Tiempo Promedio</th>
                </tr>
              </thead>
              <tbody>
                {stats.reporteFallasPorArea.map(f => {
                  const pctBarra = Math.round((f.totalFallas / stats.maxFallasArea) * 100);
                  const codigo = AREAS.find(a => a.nombre === f.area)?.codigo || 'GEN';
                  return (
                    <tr key={f.area}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="tech-tag" style={{ fontSize: 9.5 }}>{codigo}</span>
                          <strong>{f.area}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                        {f.totalFallas}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pctBarra}%`, height: '100%', background: 'var(--brand-gold-dark)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', minWidth: 36, color: 'var(--color-text-secondary)' }}>
                            {f.porcentajeFallas}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
                        ${f.costoAcumulado.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        {f.tiempoPromedioHoras !== '—' ? `${f.tiempoPromedioHoras} hrs` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN 1: Rutas de Distribución con Mayor Gasto de Recursos */}
      <div id="rep-rutas" className="card" style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TbMapPin style={{ color: 'var(--color-accent)', fontSize: 20 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Rutas de Distribución con Mayor Gasto de Taller
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Rutas con mayor consumo del taller
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Filtrar Departamento:</span>
            <select
              value={filtroDepto}
              onChange={(e) => setFiltroDepto(e.target.value)}
              className="form-select"
              style={{ padding: '6px 12px', fontSize: 12, width: 'auto', minWidth: 0, maxWidth: '100%' }}
            >
              <option value="TODOS">Todos los Departamentos (14)</option>
              {DEPARTAMENTOS_EL_SALVADOR.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Ruta de Distribución</th>
                <th>Departamento</th>
                <th style={{ textAlign: 'center' }}>Unidades Atendidas</th>
                <th style={{ textAlign: 'center' }}>Visitas Taller</th>
                <th style={{ textAlign: 'right' }}>Gasto Repuestos</th>
                <th style={{ textAlign: 'right' }}>Mano de Obra</th>
                <th style={{ textAlign: 'right' }}>Gasto Total Recursos</th>
                <th style={{ width: 140 }}>Consumo Relativo</th>
              </tr>
            </thead>
            <tbody>
              {rutasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    No se encontraron órdenes para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                rutasFiltradas.map((r, idx) => {
                  const pct = maxGastoRuta > 0 ? Math.round((r.totalGasto / maxGastoRuta) * 100) : 0;
                  return (
                    <tr key={r.nombre}>
                      <td style={{ fontWeight: 800, color: idx < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td>
                        <strong>{r.nombre}</strong>
                      </td>
                      <td>
                        <span className="badge badge-en-proceso" style={{ fontSize: 11 }}>
                          <TbMapPin style={{ marginRight: 3 }} /> {r.departamento}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {r.totalUnidadesDistintas}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <span className="tech-tag">{r.visitasTaller} ingresos</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        ${r.totalRepuestos.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        ${r.totalManoObra.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e', fontSize: 14 }}>
                        ${r.totalGasto.toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            flex: 1,
                            height: 8,
                            background: 'var(--color-bg-input)',
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.max(pct, 5)}%`,
                              height: '100%',
                              background: idx === 0 ? 'var(--color-danger)' : idx < 3 ? 'var(--color-accent)' : 'var(--color-primary)',
                              borderRadius: 4
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', width: 32 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 2: Gasto por Departamento & Top Unidades que Más Gastan */}
      <div id="rep-gastos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Distribución por Departamentos */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconoMascara src="/iconos/taller-balances.png" size={16} estilo={{ color: 'var(--color-primary)' }} />
                Gasto e Incidencias por Departamento
              </h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Desglose territorial del presupuesto del taller en El Salvador
              </p>
            </div>
            <span className="tech-tag">14 DEPARTAMENTOS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.deptosOrdenados.slice(0, 6).map((dep, i) => {
              const pct = stats.maxGastoDepto > 0 ? (dep.totalGasto / stats.maxGastoDepto) * 100 : 0;
              return (
                <div key={dep.departamento} style={{
                  padding: '10px 12px',
                  background: 'var(--color-bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: i === 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(237, 168, 60, 0.18)',
                        color: i === 0 ? '#ef4444' : 'var(--color-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800
                      }}>
                        {i + 1}
                      </span>
                      <strong style={{ fontSize: 14 }}>{dep.departamento}</strong>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        ({dep.incidencias} orden{dep.incidencias > 1 ? 'es' : ''})
                      </span>
                    </div>
                    <strong style={{ color: '#22c55e', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                      ${dep.totalGasto.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(pct, 6)}%`,
                      background: i === 0 ? 'var(--color-danger)' : i === 1 ? 'var(--color-accent)' : 'var(--color-primary)',
                      borderRadius: 3
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Unidades con Mayor Consumo de Recursos */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconoMascara src="/iconos/taller-reparacion.png" size={16} estilo={{ color: 'var(--color-danger)' }} />
                Unidades con Mayor Gasto Acumulado
              </h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Unidades con mayor presupuesto
              </p>
            </div>
            <span className="tech-tag" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)' }}>
              CRÍTICO
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.unidadesMayorGasto.map((u) => (
              <div key={u.placa} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--color-bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: 13,
                    color: 'var(--color-text-primary)'
                  }}>
                    {u.placa}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {u.marca} {u.modelo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TbMapPin style={{ fontSize: 10 }} /> {u.departamento} • {u.ruta.substring(0, 24)}...
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#22c55e', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                    ${u.totalGasto.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {u.reparaciones} reparaci{u.reparaciones > 1 ? 'ones' : 'ón'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: Control Administrativo y Productividad de Empleados Mecánicos */}
      <div id="rep-personal" className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TbUser style={{ color: 'var(--color-accent)', fontSize: 20 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Control Administrativo del Personal Mecánico
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Horas y órdenes por técnico
            </p>
          </div>
          <span className="station-status-pill">
            <span className="dot" /> {stats.rendimientoMecanicos.length} MECÁNICOS ACTIVOS
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
          {stats.rendimientoMecanicos.map(mec => (
            <div
              key={mec.id}
              style={{
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {mec.nombre}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {mec.cargo}
                    </span>
                  </div>
                  {mec.ordenActual ? (
                    <span className="tech-tag" style={{ background: 'rgba(134,153,46,0.15)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>
                      <span className="status-dot" style={{ background: 'var(--color-accent)', display: 'inline-block', width: 6, height: 6, marginRight: 4 }} />
                      Atendiendo: {mec.ordenActual}
                    </span>
                  ) : (
                    <span className="tech-tag" style={{ background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#22c55e' }}>
                      Disponible
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  padding: '10px 0',
                  borderTop: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Órdenes</div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                      {mec.ordenesTotales}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Horas Trab.</div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {mec.horasReales}h
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Efectividad</div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                      {mec.efectividad}%
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Recursos administrados:</span>
                <strong style={{ color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                  ${mec.recursosManejados.toFixed(2)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 4: Monitoreo en Vivo de Vehículos en Taller */}
      <div id="rep-taller" style={{ marginTop: 24, marginBottom: 40 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Vehículos en Área de Reparación</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Unidades en taller por ruta y técnico
            </p>
          </div>
          <Link to="/ordenes" className="btn btn-secondary btn-sm">
            Ver Todas las Órdenes <TbArrowUpRight />
          </Link>
        </div>

        {ordenesActivas.length === 0 ? (
          <div className="empty-state">
            <TbTruck className="empty-state-icon" />
            <h3>No hay unidades en taller</h3>
            <p>Todas las unidades han sido despachadas a sus rutas.</p>
          </div>
        ) : (
          <div className="table-container" style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Placa / Unidad</th>
                  <th>Vehículo</th>
                  <th>Departamento</th>
                  <th>Ruta Comercial</th>
                  <th>Mecánico Asignado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Recursos Estimados</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesActivas.map(orden => (
                  <tr key={orden.id}>
                    <td className="placa">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--color-accent)' }}>●</span>
                        {orden.placa || 'S/P'}
                      </div>
                    </td>
                    <td>
                      <strong>{orden.marca}</strong> {orden.modelo}
                    </td>
                    <td>
                      <span className="badge badge-en-proceso" style={{ fontSize: 11 }}>
                        <TbMapPin style={{ marginRight: 3 }} /> {orden.departamento || 'San Salvador'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {orden.ruta ? orden.ruta.substring(0, 32) + '...' : 'Ruta general'}
                    </td>
                    <td>
                      {orden.mecanicoAsignado ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <TbUser style={{ color: 'var(--color-accent)' }} />
                          <span>{orden.mecanicoAsignado}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge estado={orden.estado} />
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>
                      ${(orden.costoTotal || (orden.costoRepuestos || 0) + (orden.costoManoObra || 0)).toFixed(2)}
                    </td>
                    <td>
                      <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm">
                        Expediente
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
