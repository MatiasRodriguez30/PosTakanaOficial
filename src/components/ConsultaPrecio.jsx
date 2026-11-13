import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { api, getApiUrl } from '../api';
import { Search, Camera, Package, Tag, X, AlertCircle } from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useBusquedaInteligente, ordenarPorBusqueda, AvisoBusqueda } from '../busqueda';
import { leerCatalogo } from '../sinConexion';
import { formatearPesos, reproducirBeepEscaneo } from '../formato';

const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Code93,
  BarcodeFormat.Itf, BarcodeFormat.Codabar, BarcodeFormat.QrCode,
];

// Pantalla para consultar rápido el precio de un producto (por nombre o
// escaneando el código de barras) sin tener que armar una venta.
export default function ConsultaPrecio() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [highlightSku, setHighlightSku] = useState(null);
  const busqueda = useBusquedaInteligente(search);
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/productos')
      .then((data) => {
        setProductos(data);
        setErrorCarga('');
      })
      .catch((e) => {
        const guardado = leerCatalogo();
        if (guardado) {
          setProductos(guardado.prods);
        } else {
          setErrorCarga(e.message || 'No se pudo cargar el catálogo.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const esCodigoExacto = (texto) => {
    const codigo = texto.trim();
    return codigo !== '' && productos.some((p) => (p.presentaciones || []).some((pp) => pp.sku === codigo));
  };

  const handleScanResult = (sku) => {
    setScannerOpen(false);
    setHighlightSku(sku);
    setSearch(sku);
    reproducirBeepEscaneo(esCodigoExacto(sku));
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

  // Un código por consulta: el lector USB/Bluetooth escribe el código y manda
  // Enter. Con el Enter se selecciona todo, así el próximo escaneo (o lo que se
  // escriba) reemplaza al anterior en vez de sumarse.
  const ultimaTecla = useRef(0);
  const alTeclear = (e) => {
    const ahora = Date.now();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (esCodigoExacto(search)) {
        setHighlightSku(search.trim());
        reproducirBeepEscaneo(true);
      } else if (search.trim()) {
        reproducirBeepEscaneo(false);
      }
      e.target.select();
    } else if (e.key.length === 1 && ahora - ultimaTecla.current > 800 && esCodigoExacto(search)) {
      e.target.select();
    }
    ultimaTecla.current = ahora;
  };

  const term = search.trim().toLowerCase();
  const resultados =
    term === ''
      ? []
      : busqueda && busqueda.ids.length > 0
      ? ordenarPorBusqueda(productos, busqueda)
      : productos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(term) ||
            (p.presentaciones || []).some((pp) => pp.sku && pp.sku.toLowerCase().includes(term))
        );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Search className="text-brand-700 dark:text-brand-400" size={22} />
          Consultar Precio
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-0.5">
          Buscá por nombre o escaneá el código de barras para ver el precio al instante
        </p>
      </div>

      <div className="p-4 md:p-6 pb-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder="Nombre del producto o código de barras…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightSku(null);
              }}
              onKeyDown={alTeclear}
              className="w-full h-12 pl-11 pr-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-brand-700 dark:focus:ring-brand-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setHighlightSku(null);
                  inputRef.current?.focus();
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openScanner}
            title="Escanear con la cámara"
            aria-label="Escanear con la cámara"
            className="shrink-0 h-12 px-4 md:px-5 btn-brand flex items-center justify-center gap-2 text-sm"
          >
            <Camera size={20} />
            <span className="hidden sm:inline">Escanear</span>
          </button>
        </div>
        <div className="mt-2">
          <AvisoBusqueda resultado={busqueda} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        {loading ? (
          <div className="surface-card flex flex-col items-center justify-center h-64 text-slate-600 dark:text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando catálogo...</p>
          </div>
        ) : errorCarga ? (
          <div className="surface-card flex flex-col items-center justify-center h-64 text-center p-6 gap-2">
            <AlertCircle size={36} className="text-red-700 dark:text-red-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No se pudo cargar</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{errorCarga}</p>
          </div>
        ) : term === '' ? (
          <div className="surface-card flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500 dark:text-slate-400">
            <Search size={40} className="mb-2 opacity-40" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Escribí un nombre o escaneá un código
            </p>
            <p className="text-xs mt-1">Podés usar el lector USB/Bluetooth o la cámara del dispositivo.</p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center h-64 text-center p-6 gap-3">
            <Package size={40} className="text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No se encontró ningún producto para «{search}»
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Revisá la ortografía o probá escaneando otro código.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setHighlightSku(null);
                inputRef.current?.focus();
              }}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Nueva búsqueda
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {resultados.map((prod) => (
              <div key={prod.id} className="surface-card overflow-hidden flex flex-col">
                <div className="h-36 bg-slate-100 dark:bg-slate-700/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                  {prod.imgUrlProducto ? (
                    <img
                      src={`${getApiUrl()}${prod.imgUrlProducto}`}
                      alt={prod.nombre}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={36} className="text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-slate-900 dark:text-slate-100 font-bold text-base leading-snug">
                    {prod.nombre}
                  </h3>
                  {(prod.categorias_asociadas || []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {prod.categorias_asociadas.map((c) => (
                        <span
                          key={c.codCategoria}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                        >
                          <Tag size={10} /> {c.categoria?.nombreCategoria || ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    {(prod.presentaciones || []).length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Sin precio cargado</p>
                    ) : (
                      prod.presentaciones.map((p) => {
                        const coincide = p.sku && p.sku === highlightSku;
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                              coincide
                                ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-700 dark:border-brand-400'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="text-slate-800 dark:text-slate-200 font-medium text-sm block truncate">
                                {p.tipo_presentacion?.nombreTipoPresentacion}
                              </span>
                              {p.sku && (
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                                  {p.sku}
                                </span>
                              )}
                            </div>
                            <span className="text-xl md:text-2xl font-bold text-brand-700 dark:text-brand-300 tabular-nums shrink-0">
                              {formatearPesos(p.precio)}
                            </span>
                          </div>
                        );
                      })
                    )}
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
