import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { History, Search, ChevronDown, ChevronUp, User, CreditCard, Package, X } from 'lucide-react';

export default function Historial() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detalle, setDetalle] = useState({});
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/registros');
      setRegistros(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalle = async (nro) => {
    if (detalle[nro]) return;
    setLoadingDetalle(true);
    try {
      const data = await api.get(`/api/registros/${nro}`);
      setDetalle(prev => ({ ...prev, [nro]: data }));
    } catch (e) {
      console.error(e);
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

  const filtered = registros.filter(r =>
    String(r.nroRegistro).includes(search) ||
    (r.usuario?.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.medio_pago?.nombreMedioPago || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalHoy = registros
    .filter(r => new Date(r.fechaRegistro).toDateString() === new Date().toDateString())
    .reduce((acc, r) => acc + r.montoTotalRegistro, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <History className="text-indigo-400" size={26} />
            Historial de Ventas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {registros.length} registros en total · Facturado hoy: <span className="text-emerald-400 font-semibold">${totalHoy.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Nro, vendedor o medio de pago..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-20">Cargando registros...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-20">No hay registros de venta aún.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(reg => (
              <div key={reg.nroRegistro} className="glass-panel rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(reg.nroRegistro)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
                      #{reg.nroRegistro}
                    </div>
                    <div className="text-left">
                      <div className="text-slate-200 font-medium">
                        ${reg.montoTotalRegistro.toFixed(2)}
                      </div>
                      <div className="text-slate-500 text-xs flex items-center gap-2 mt-0.5">
                        <span>{new Date(reg.fechaRegistro).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <User size={12} />
                        <span>{reg.usuario?.username || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <CreditCard size={12} />
                        <span>{reg.medio_pago?.nombreMedioPago || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {expandedId === reg.nroRegistro ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {expandedId === reg.nroRegistro && (
                  <div className="border-t border-slate-700/50 p-4 bg-slate-900/40">
                    {loadingDetalle && !detalle[reg.nroRegistro] ? (
                      <p className="text-slate-500 text-sm text-center py-4">Cargando detalle...</p>
                    ) : detalle[reg.nroRegistro] ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500 text-xs uppercase tracking-wider">
                            <th className="text-left pb-2">Producto</th>
                            <th className="text-center pb-2">Cant.</th>
                            <th className="text-right pb-2">P. Unit.</th>
                            <th className="text-right pb-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detalle[reg.nroRegistro].detalles || []).map((d, i) => (
                            <tr key={i} className="border-t border-slate-700/30">
                              <td className="py-2 text-slate-300 flex items-center gap-2">
                                <Package size={14} className="text-slate-500" />
                                {d.producto_presentacion
                                  ? `${d.producto_presentacion.producto?.nombre || 'Producto eliminado'} · ${d.producto_presentacion.tipo_presentacion?.nombreTipoPresentacion || ''}`
                                  : 'Producto eliminado'}
                              </td>
                              <td className="py-2 text-center text-slate-400">{d.cantidadRegistroPedido}</td>
                              <td className="py-2 text-right text-slate-400">${d.precioUnitarioPedidoProducto?.toFixed(2)}</td>
                              <td className="py-2 text-right text-emerald-400 font-medium">${d.subTotalPedidoProducto?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-600">
                            <td colSpan={3} className="pt-3 text-right text-slate-400 font-semibold text-sm">Total</td>
                            <td className="pt-3 text-right text-white font-bold">${reg.montoTotalRegistro.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
