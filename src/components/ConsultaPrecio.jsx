import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { api, getApiUrl } from '../api';
import { Search, Camera, Package, Tag } from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useBusquedaInteligente, ordenarPorBusqueda, AvisoBusqueda } from '../busqueda';
import { leerCatalogo } from '../sinConexion';

const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Code93,
  BarcodeFormat.Itf, BarcodeFormat.Codabar, BarcodeFormat.QrCode,
];

// Pantalla para consultar rápido el precio de un producto (por nombre o
// escaneando el código de barras) sin tener que armar una venta. Pensada para
// cuando alguien está solo a cargo del local y necesita saber cuánto sale algo.
export default function ConsultaPrecio() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [highlightSku, setHighlightSku] = useState(null); // sku escaneado, para resaltar esa presentación puntual
  const busqueda = useBusquedaInteligente(search);

  useEffect(() => {
    api.get('/api/productos')
      .then(setProductos)
      .catch((e) => {
        // Sin conexión: la última copia guardada por el POS en este equipo
        const guardado = leerCatalogo();
        if (guardado) setProductos(guardado.prods);
        else console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleScanResult = (sku) => {
    setScannerOpen(false);
    setHighlightSku(sku);
    setSearch(sku);
  };

  const openScanner = async () => {
    if (!Capacitor.isNativePlatform()) {
      setScannerOpen(true);
      return;
    }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: NATIVE_SCAN_FORMATS });
      if (barcodes && barcodes.length > 0) handleScanResult(barcodes[0].rawValue);
    } catch (err) {
      alert('No se pudo usar la cámara: ' + (err.message || err));
    }
  };

  const term = search.trim().toLowerCase();
  const resultados = term === '' ? []
    : busqueda && busqueda.ids.length > 0 ? ordenarPorBusqueda(productos, busqueda)
    : productos.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.presentaciones || []).some(pp => pp.sku && pp.sku.toLowerCase().includes(term))
    );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <Search className="text-indigo-400" size={26} /> Consultar Precio
        </h1>
        <p className="text-slate-400 text-sm mt-1">Buscá por nombre o escaneá el código de barras</p>
      </div>

      <div className="p-6 pb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Nombre del producto..."
              value={search}
              onChange={e => { setSearch(e.target.value); setHighlightSku(null); }}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white text-lg focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button type="button" onClick={openScanner} title="Escanear con la cámara"
            className="shrink-0 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center">
            <Camera size={22} />
          </button>
        </div>
        <div className="mt-2"><AvisoBusqueda resultado={busqueda} /></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-0">
        {loading ? (
          <div className="text-center text-slate-500 py-20">Cargando...</div>
        ) : term === '' ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Search size={48} className="mb-2 opacity-30" />
            <p>Escribí un nombre o escaneá un código</p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Package size={48} className="mb-2 opacity-30" />
            <p>No se encontró ningún producto</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultados.map(prod => (
              <div key={prod.id} className="glass-panel rounded-xl overflow-hidden border border-slate-700/50">
                <div className="h-40 bg-slate-800/60 flex items-center justify-center">
                  {prod.imgUrlProducto
                    ? <img src={`${getApiUrl()}${prod.imgUrlProducto}`} alt={prod.nombre} className="w-full h-full object-cover" />
                    : <Package size={40} className="text-slate-600" />
                  }
                </div>
                <div className="p-4">
                  <h3 className="text-slate-100 font-semibold text-lg">{prod.nombre}</h3>
                  {(prod.categorias_asociadas || []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {prod.categorias_asociadas.map(c => (
                        <span key={c.codCategoria} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-700/60 text-slate-400">
                          <Tag size={10} /> {c.categoria?.nombreCategoria || ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 space-y-1.5">
                    {(prod.presentaciones || []).length === 0 ? (
                      <p className="text-slate-500 text-sm">Sin precio cargado</p>
                    ) : prod.presentaciones.map(p => (
                      <div key={p.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm ${p.sku === highlightSku ? 'bg-indigo-600/25 border border-indigo-500/60' : 'bg-slate-800/40'}`}>
                        <span className="text-slate-300">{p.tipo_presentacion?.nombreTipoPresentacion}</span>
                        <span className="text-emerald-400 font-bold text-base">${p.precio.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scannerOpen && (
        <BarcodeScannerModal onScan={handleScanResult} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
