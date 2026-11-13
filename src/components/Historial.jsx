import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  History,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  CreditCard,
  Package,
  Printer,
  Share2,
  Copy,
  Check,
  WifiOff,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  formatearPesos,
  formatearCantidad,
  formatearFechaHora,
  esHoyArgentina,
  esUltimosDiasArgentina,
  imprimirTicket,
  compartirWhatsApp,
  copiarTicket,
} from '../formato';

export default function Historial() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState('todas'); // 'hoy' | '7dias' | 'todas'
  const [medioPagoFiltro, setMedioPagoFiltro] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [detalle, setDetalle] = useState({});
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    setLoading(true);
    setErrorCarga('');
    try {
      const data = await api.get('/api/registros');
      setRegistros(data);
    } catch (e) {
      console.error(e);
      setErrorCarga(e.message || 'No se pudo cargar el historial de ventas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalle = async (nro) => {
    if (detalle[nro]) return detalle[nro];
    setLoadingDetalle(true);
    try {
      const data = await api.get(`/api/registros/${nro}`);
      setDetalle((prev) => ({ ...prev, [nro]: data }));
      return data;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setLoadingDetalle(false);
    }
  };

  const toggleExpand = (nro) => {
    if (expandedId === nro) {
      setExpandedId(null);
    } else {
      setExpandedId(nro);
      fetchDetalle(nro);
    }
  };

  const construirVentaTicket = (reg, detData) => ({
    nroRegistro: reg.nroRegistro,
    fechaRegistro: reg.fechaRegistro,
    vendedor: reg.usuario?.username || '',
    medioPago: reg.medio_pago?.nombreMedioPago || '',
    total: reg.montoTotalRegistro,
    items: (detData?.detalles || []).map((d) => ({
      nombre: d.producto_presentacion?.producto?.nombre || 'Producto eliminado',
      presentacion: d.producto_presentacion?.tipo_presentacion?.nombreTipoPresentacion || '',
      cantidad: d.cantidadRegistroPedido,
      precioUnitario: d.precioUnitarioPedidoProducto,
      subtotal: d.subTotalPedidoProducto,
    })),
  });

  const handleCopiar = async (reg) => {
    const det = detalle[reg.nroRegistro] || (await fetchDetalle(reg.nroRegistro));
    if (!det) return;
    const ok = await copiarTicket(construirVentaTicket(reg, det));
    if (ok) {
      setCopiadoId(reg.nroRegistro);
      setTimeout(() => setCopiadoId((prev) => (prev === reg.nroRegistro ? null : prev)), 2000);
    }
  };

  const handleImprimir = async (reg) => {
    const det = detalle[reg.nroRegistro] || (await fetchDetalle(reg.nroRegistro));
    if (!det) return;
    imprimirTicket(construirVentaTicket(reg, det));
  };

  const handleWhatsApp = async (reg) => {
    const det = detalle[reg.nroRegistro] || (await fetchDetalle(reg.nroRegistro));
    if (!det) return;
    compartirWhatsApp(construirVentaTicket(reg, det));
  };

  const mediosDisponibles = Array.from(
    new Set(registros.map((r) => r.medio_pago?.nombreMedioPago).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const filtered = registros.filter((r) => {
    const term = search.trim().toLowerCase();
    const matchSearch =
      !term ||
      String(r.nroRegistro).includes(term) ||
      (r.usuario?.username || '').toLowerCase().includes(term) ||
      (r.medio_pago?.nombreMedioPago || '').toLowerCase().includes(term);

    const matchPeriodo =
      periodo === 'hoy'
        ? esHoyArgentina(r.fechaRegistro)
        : periodo === '7dias'
        ? esUltimosDiasArgentina(r.fechaRegistro, 7)
        : true;

    const matchMedio = !medioPagoFiltro || r.medio_pago?.nombreMedioPago === medioPagoFiltro;

    return matchSearch && matchPeriodo && matchMedio;
  });

  const ventasHoy = registros.filter((r) => esHoyArgentina(r.fechaRegistro));
  const totalHoy = ventasHoy.reduce((acc, r) => acc + (r.montoTotalRegistro || 0), 0);
  const totalFiltrado = filtered.reduce((acc, r) => acc + (r.montoTotalRegistro || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabecera con métricas */}
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <History className="text-brand-700 dark:text-brand-400" size={22} />
              Historial de Ventas
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-0.5">
              Horarios expresados en hora de Argentina (UTC-3)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                Facturado hoy
              </span>
              <span className="text-sm md:text-base font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                {formatearPesos(totalHoy)}
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                Ventas hoy
              </span>
              <span className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {ventasHoy.length}
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                Total filtrado ({filtered.length})
              </span>
              <span className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatearPesos(totalFiltrado)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros y lista */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nro, vendedor o medio de pago…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base h-10 pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900">
              {[
                { id: 'hoy', label: 'Hoy' },
                { id: '7dias', label: 'Últimos 7 días' },
                { id: 'todas', label: 'Todas' },
              ].map((op, i) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setPeriodo(op.id)}
                  className={`h-10 px-3 text-xs font-semibold transition-colors ${
                    i > 0 ? 'border-l border-slate-300 dark:border-slate-600' : ''
                  } ${
                    periodo === op.id
                      ? 'bg-brand-700 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filtrar por medio de pago"
              value={medioPagoFiltro}
              onChange={(e) => setMedioPagoFiltro(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-700"
            >
              <option value="">Todos los medios</option>
              {mediosDisponibles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-slate-600 dark:text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando registros...</p>
          </div>
        ) : errorCarga ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-center p-6 gap-3">
            <AlertCircle size={36} className="text-red-700 dark:text-red-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{errorCarga}</p>
            <button type="button" onClick={fetchRegistros} className="btn-secondary px-4 py-2 text-xs">
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-center p-6 gap-3">
            <History size={38} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {registros.length === 0 ? 'Todavía no hay ventas registradas.' : 'No hay ventas para este filtro.'}
            </p>
            {(search || periodo !== 'todas' || medioPagoFiltro) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPeriodo('todas');
                  setMedioPagoFiltro('');
                }}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Ver todas las ventas
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((reg) => {
              const abierta = expandedId === reg.nroRegistro;
              return (
                <div key={reg.nroRegistro} className="surface-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(reg.nroRegistro)}
                    aria-expanded={abierta}
                    className="w-full flex items-center justify-between p-3.5 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="px-2.5 py-1.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-300 font-mono font-bold text-xs shrink-0">
                        #{reg.nroRegistro}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-900 dark:text-slate-100 font-bold text-base tabular-nums">
                            {formatearPesos(reg.montoTotalRegistro)}
                          </span>
                          {reg.sinConexion && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
                              <WifiOff size={11} /> Sin conexión
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 text-xs mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>{formatearFechaHora(reg.fechaRegistro)}</span>
                          <span className="sm:hidden">· {reg.medio_pago?.nombreMedioPago || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <User size={12} className="text-slate-500" />
                          <span>{reg.usuario?.username || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <CreditCard size={12} />
                          <span>{reg.medio_pago?.nombreMedioPago || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {abierta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </button>

                  {abierta && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4">
                      {loadingDetalle && !detalle[reg.nroRegistro] ? (
                        <p className="text-slate-600 dark:text-slate-400 text-sm text-center py-4">
                          Cargando detalle de la venta...
                        </p>
                      ) : detalle[reg.nroRegistro] ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                  <th className="text-left pb-2 font-semibold">Producto</th>
                                  <th className="text-right pb-2 font-semibold">Cant.</th>
                                  <th className="text-right pb-2 font-semibold">P. Unit.</th>
                                  <th className="text-right pb-2 font-semibold">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
                                {(detalle[reg.nroRegistro].detalles || []).map((d, i) => (
                                  <tr key={i}>
                                    <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                                      <span className="inline-flex items-center gap-2">
                                        <Package size={14} className="text-slate-400 shrink-0" />
                                        <span>
                                          {d.producto_presentacion
                                            ? `${d.producto_presentacion.producto?.nombre || 'Producto eliminado'} · ${
                                                d.producto_presentacion.tipo_presentacion?.nombreTipoPresentacion || ''
                                              }`
                                            : 'Producto eliminado'}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="py-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                                      {formatearCantidad(d.cantidadRegistroPedido)}
                                    </td>
                                    <td className="py-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                                      {formatearPesos(d.precioUnitarioPedidoProducto)}
                                    </td>
                                    <td className="py-2 text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
                                      {formatearPesos(d.subTotalPedidoProducto)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-slate-300 dark:border-slate-600">
                                  <td colSpan={3} className="pt-2.5 text-right text-slate-600 dark:text-slate-400 font-semibold text-sm">
                                    Total
                                  </td>
                                  <td className="pt-2.5 text-right text-slate-900 dark:text-slate-100 font-bold text-base tabular-nums">
                                    {formatearPesos(reg.montoTotalRegistro)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Acciones de comprobante */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleImprimir(reg)}
                              className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Printer size={14} /> Imprimir ticket (58/80 mm)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWhatsApp(reg)}
                              className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Share2 size={14} /> Enviar por WhatsApp
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopiar(reg)}
                              className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              {copiadoId === reg.nroRegistro ? <Check size={14} className="text-green-700" /> : <Copy size={14} />}
                              {copiadoId === reg.nroRegistro ? 'Copiado' : 'Copiar comprobante'}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
