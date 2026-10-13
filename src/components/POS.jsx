import React, { useState, useEffect, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { CartContext } from '../context/CartContext';
import { api, getApiUrl } from '../api';
import BarcodeScannerModal from './BarcodeScannerModal';
import { Search, Plus, Minus, Trash2, CreditCard, ShoppingCart, Tag, CheckCircle, Package, X, ChevronRight, ChevronDown, ChevronUp, Camera } from 'lucide-react';

// Códigos de barras que puede tener un producto de este POS (coincide con lo
// que ya soportaba el scanner web con html5-qrcode).
const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Code93,
  BarcodeFormat.Itf, BarcodeFormat.Codabar, BarcodeFormat.QrCode,
];

const POS = () => {
  const { cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart } = useContext(CartContext);
  const [cartExpanded, setCartExpanded] = useState(false);

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedMedioPago, setSelectedMedioPago] = useState(null);

  // Modal de selección de presentación
  const [presentacionModal, setPresentacionModal] = useState(null); // producto seleccionado

  const [scannedSku, setScannedSku] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [prods, cats, pagos] = await Promise.all([
          api.get('/api/productos'),
          api.get('/api/categorias'),
          api.get('/api/medios-pago')
        ]);
        // Solo mostrar productos que tienen al menos una presentación
        setProductos(prods.filter(p => p.presentaciones && p.presentaciones.length > 0));
        setCategorias(cats);
        setMediosPago(pagos);
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Escáner de código de barras
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.id !== 'search-input') return;
      const now = Date.now();
      if (now - lastKeyTime.current > 50) barcodeBuffer.current = '';
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 2) {
          handleBarcodeScan(barcodeBuffer.current);
          barcodeBuffer.current = '';
          e.preventDefault();
        } else if (isCheckoutModalOpen) {
          handleConfirmSale();
        } else if (cartItems.length > 0 && document.activeElement.tagName !== 'INPUT') {
          openCheckout();
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
      lastKeyTime.current = now;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productos, isCheckoutModalOpen, cartItems]);

  const handleBarcodeScan = (sku) => {
    // El código de barras identifica una presentación puntual (1kg/10kg/20kg
    // suelen tener SKUs distintos), así que agregamos ESA presentación directo,
    // sin pasar por el selector aunque el producto tenga varias.
    for (const prod of productos) {
      const ptp = (prod.presentaciones || []).find(p => p.sku === sku);
      if (ptp) { addToCart({ ...prod, selectedPtp: ptp }); return; }
    }
    setScannedSku(sku);
    setIsProductModalOpen(true);
  };

  const handleCameraScan = (sku) => {
    setIsCameraScannerOpen(false);
    handleBarcodeScan(sku);
  };

  // Dentro de la app Android usamos el scanner nativo de ML Kit (cámara real de
  // Android, no la cámara "web" del navegador) — mucho más confiable para enfocar
  // de cerca en celulares con varias lentes traseras. En el navegador (PC, dev)
  // seguimos usando el modal con html5-qrcode de siempre.
  const openScanner = async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsCameraScannerOpen(true);
      return;
    }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: NATIVE_SCAN_FORMATS });
      if (barcodes && barcodes.length > 0) handleBarcodeScan(barcodes[0].rawValue);
    } catch (err) {
      console.error('Error al escanear:', err);
      alert('No se pudo usar la cámara: ' + (err.message || err));
    }
  };

  // Al hacer clic en un producto
  const handleProductClick = (prod) => {
    if (!prod.presentaciones || prod.presentaciones.length === 0) return;
    if (prod.presentaciones.length === 1) {
      // Una sola presentación → agregar directo
      const ptp = prod.presentaciones[0];
      addToCart({ ...prod, selectedPtp: ptp });
    } else {
      // Múltiples → mostrar selector
      setPresentacionModal(prod);
    }
  };

  const handleSelectPresentacion = (prod, ptp) => {
    addToCart({ ...prod, selectedPtp: ptp });
    setPresentacionModal(null);
  };

  const openCheckout = () => {
    const defaultPago = mediosPago.find(m => m.is_default) || mediosPago[0];
    setSelectedMedioPago(defaultPago?.codMedioPago || null);
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmSale = async () => {
    if (!selectedMedioPago) { alert('Seleccioná un medio de pago.'); return; }
    try {
      await api.post('/api/registros', {
        codMedioPago: selectedMedioPago,
        detalles: cartItems.map(item => ({
          idProductoTipoPresentacion: item.selectedPtp.id,
          cantidadRegistroPedido: item.cantidad
        }))
      });
      clearCart();
      setIsCheckoutModalOpen(false);
    } catch (error) {
      alert('Error al registrar la venta: ' + error.message);
    }
  };

  const filteredProducts = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.presentaciones || []).some(pp => pp.sku && pp.sku.includes(searchTerm));
    const matchCat = selectedCategory ? (p.categorias_asociadas || []).some(c => c.codCategoria === selectedCategory) : true;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex flex-col md:flex-row h-full p-2 md:p-4 gap-3 md:gap-4 overflow-hidden">

      {/* CARRITO — en mobile es desplegable (colapsado por defecto) para no comerse la pantalla */}
      <div className={`order-2 md:order-1 w-full md:w-1/3 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-lg relative border border-slate-700/50 md:max-h-none shrink-0 md:shrink ${cartExpanded ? 'max-h-[70vh]' : ''} md:max-h-none`}>
        <button
          type="button"
          onClick={() => setCartExpanded(v => !v)}
          className="p-4 border-b border-slate-700/50 bg-slate-900/40 flex items-center justify-between text-left md:pointer-events-none"
        >
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-indigo-400" size={20} />
            Ticket de Venta
            {cartItems.length > 0 && (
              <span className="text-xs font-medium bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full">{cartItems.length}</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-100">${total.toFixed(2)}</span>
            {cartExpanded ? <ChevronUp size={20} className="text-slate-400 md:hidden" /> : <ChevronDown size={20} className="text-slate-400 md:hidden" />}
          </div>
        </button>

        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${cartExpanded ? '' : 'hidden md:block'}`}>
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 py-6">
              <ShoppingCart size={36} className="mb-2 opacity-20" />
              <p>El carrito está vacío</p>
              <p className="text-xs mt-1">Hacé clic en un producto o escaneá</p>
            </div>
          ) : (
            cartItems.map(item => {
              const key = `${item.id}-${item.selectedPtp?.id}`;
              return (
                <div key={key} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-200 truncate text-sm">{item.nombre}</h4>
                      <p className="text-xs text-indigo-300">
                        {item.selectedPtp?.tipo_presentacion?.nombreTipoPresentacion} · ${item.selectedPtp?.precio.toFixed(2)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-2 shrink-0">
                      <span className="font-bold text-sm">${(item.selectedPtp?.precio * item.cantidad).toFixed(2)}</span>
                      <button onClick={() => removeFromCart(key)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {/* Cantidad editable — admite decimales (0.5kg, 2.5kg, etc.) */}
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={() => updateQuantity(key, Math.max(0.01, Math.round((item.cantidad - 0.5) * 100) / 100))}
                      className="p-1.5 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors">
                      <Minus size={12} />
                    </button>
                    <input
                      type="text" inputMode="decimal" value={item.cantidad}
                      onChange={e => {
                        // Admite coma o punto como separador decimal (el teclado numérico
                        // de Android en español suele mandar coma).
                        const raw = e.target.value.replace(',', '.');
                        const v = parseFloat(raw);
                        if (!isNaN(v) && v > 0) updateQuantity(key, v);
                      }}
                      className="w-16 text-center py-1 rounded-md bg-slate-900/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60"
                    />
                    <button type="button" onClick={() => updateQuantity(key, Math.round((item.cantidad + 0.5) * 100) / 100)}
                      className="p-1.5 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 md:p-5 border-t border-slate-700/50 bg-slate-900/90">
          <button
            disabled={cartItems.length === 0}
            onClick={openCheckout}
            className="w-full py-3.5 md:py-4 rounded-xl font-bold text-lg text-white btn-premium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard size={22} /> Cobrar (Enter) — ${total.toFixed(2)}
          </button>
        </div>
      </div>

      {/* CATÁLOGO — flex-1 para que absorba todo el alto disponible y el ticket quede pegado abajo */}
      <div className="order-1 md:order-2 w-full md:w-2/3 flex-1 flex flex-col gap-4 relative min-h-0">
        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-4 border border-slate-700/50">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                id="search-input"
                type="text"
                placeholder="Buscar producto o escanear código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all text-lg"
              />
            </div>
            <button
              type="button"
              onClick={openScanner}
              title="Escanear con la cámara"
              className="shrink-0 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center"
            >
              <Camera size={22} />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${!selectedCategory ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              Todos
            </button>
            {categorias.map(cat => (
              <button key={cat.codCategoria} onClick={() => setSelectedCategory(cat.codCategoria)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedCategory === cat.codCategoria ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                <Tag size={14} /> {cat.nombreCategoria}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-slate-500">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <Package size={48} className="mb-2 opacity-30" />
              <p>No hay productos disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredProducts.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => handleProductClick(prod)}
                  className="glass-panel rounded-xl p-4 cursor-pointer glass-panel-hover flex flex-col h-44 border border-slate-700/50 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60 pointer-events-none" />
                  {prod.imgUrlProducto ? (
                    <div className="absolute inset-0 -z-10 opacity-20 group-hover:opacity-40 transition-opacity bg-cover bg-center"
                      style={{ backgroundImage: `url(${getApiUrl()}${prod.imgUrlProducto})` }} />
                  ) : (
                    <div className="absolute inset-0 -z-10 opacity-10 flex items-center justify-center">
                      <Package size={64} className="text-slate-600" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-end">
                    <h3 className="font-bold text-slate-200 line-clamp-2 leading-tight drop-shadow-md text-sm">{prod.nombre}</h3>
                    {/* Mostrar todas las presentaciones */}
                    <div className="mt-1 space-y-0.5">
                      {(prod.presentaciones || []).slice(0, 2).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{p.tipo_presentacion?.nombreTipoPresentacion}</span>
                          <span className="text-emerald-300 font-semibold">${p.precio.toFixed(2)}</span>
                        </div>
                      ))}
                      {(prod.presentaciones || []).length > 2 && (
                        <p className="text-xs text-slate-500">+{prod.presentaciones.length - 2} más...</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button className="bg-indigo-500 hover:bg-indigo-400 text-white p-1.5 rounded-md shadow-md transition-colors">
                      {prod.presentaciones.length > 1 ? <ChevronRight size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: SELECCIÓN DE PRESENTACIÓN */}
      {presentacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="glass-panel rounded-2xl w-full max-w-sm shadow-lg border border-slate-700/50">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div>
                <h3 className="font-bold text-slate-100">{presentacionModal.nombre}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Seleccioná una presentación</p>
              </div>
              <button onClick={() => setPresentacionModal(null)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {(presentacionModal.presentaciones || []).map(ptp => (
                <button
                  key={ptp.id}
                  onClick={() => handleSelectPresentacion(presentacionModal, ptp)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/50 hover:bg-indigo-600/10 transition-all group"
                >
                  <span className="text-slate-200 font-medium">{ptp.tipo_presentacion?.nombreTipoPresentacion}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">${ptp.precio.toFixed(2)}</span>
                    <Plus size={16} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="p-8 rounded-2xl w-full max-w-md bg-slate-900 border border-slate-700/50 shadow-lg text-center">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-5 text-indigo-400">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Cobrar Venta</h2>
            <div className="text-4xl font-bold text-slate-100 my-6">
              ${total.toFixed(2)}
            </div>

            <div className="mb-6 text-left">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-3 block">Medio de Pago</span>
              <div className="space-y-2">
                {mediosPago.map(mp => (
                  <button key={mp.codMedioPago} type="button" onClick={() => setSelectedMedioPago(mp.codMedioPago)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      selectedMedioPago === mp.codMedioPago
                        ? 'bg-indigo-600/25 border-indigo-500/70 text-white'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600'
                    }`}>
                    <CreditCard size={18} className={selectedMedioPago === mp.codMedioPago ? 'text-indigo-400' : 'text-slate-500'} />
                    <span className="font-medium text-sm">{mp.nombreMedioPago}</span>
                    {mp.is_default && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">Predeterminado</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                Cancelar (Esc)
              </button>
              <button onClick={handleConfirmSale} autoFocus
                className="flex-1 py-3 rounded-xl font-bold text-white btn-premium">
                Confirmar (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESCÁNER DE CÁMARA */}
      {isCameraScannerOpen && (
        <BarcodeScannerModal
          onScan={handleCameraScan}
          onClose={() => setIsCameraScannerOpen(false)}
        />
      )}

      {/* MODAL: NUEVO PRODUCTO ESCANEADO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm shadow-lg">
            <h2 className="text-lg font-bold text-white mb-2">Código no reconocido</h2>
            <p className="text-slate-400 text-sm mb-4">El SKU <strong className="text-white font-mono">{scannedSku}</strong> no existe. Crealo desde la sección Productos.</p>
            <button onClick={() => setIsProductModalOpen(false)} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
