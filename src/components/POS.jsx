import React, { useState, useEffect, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { api, getApiUrl } from '../api';
import { guardarCatalogo, leerCatalogo, encolarVenta, nuevoIdVenta } from '../sinConexion';
import BarcodeScannerModal from './BarcodeScannerModal';
import CantidadTicket from './CantidadTicket';
import { useBusquedaInteligente, ordenarPorBusqueda, AvisoBusqueda } from '../busqueda';
import {
  formatearPesos,
  formatearCantidad,
  reproducirBeepEscaneo,
  imprimirTicket,
  compartirWhatsApp,
  copiarTicket,
} from '../formato';
import {
  Search,
  Plus,
  Trash2,
  CreditCard,
  ShoppingCart,
  Tag,
  CheckCircle2,
  Package,
  X,
  ChevronRight,
  ChevronUp,
  Camera,
  LayoutGrid,
  List,
  Printer,
  Share2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

// Códigos de barras que puede tener un producto de este POS (coincide con lo
// que ya soportaba el scanner web con html5-qrcode).
const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Code93,
  BarcodeFormat.Itf, BarcodeFormat.Codabar, BarcodeFormat.QrCode,
];

const BILLETES_RAPIDOS = [2000, 5000, 10000, 20000];

const POS = () => {
  const { cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  const [cartExpanded, setCartExpanded] = useState(false);
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem('TAKANA_POS_VISTA') || 'cuadricula';
    } catch {
      return 'cuadricula';
    }
  });

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const busqueda = useBusquedaInteligente(searchTerm);

  const [isLoading, setIsLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedMedioPago, setSelectedMedioPago] = useState(null);
  const [montoRecibidoTxt, setMontoRecibidoTxt] = useState('');

  // Modal de selección de presentación
  const [presentacionModal, setPresentacionModal] = useState(null);

  const [scannedSku, setScannedSku] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Resaltado breve y anuncio accesible al agregar un renglón
  const [ultimoAgregadoKey, setUltimoAgregadoKey] = useState(null);
  const [anuncioEscaneo, setAnuncioEscaneo] = useState('');

  // Sin conexión y comprobante post-venta
  const [catalogoGuardadoEn, setCatalogoGuardadoEn] = useState(null);
  const [aviso, setAviso] = useState('');
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [ticketCopiado, setTicketCopiado] = useState(false);
  const [cobrandoEstado, setCobrandoEstado] = useState(false);

  const searchInputRef = useRef(null);
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const cobrando = useRef(false);

  const cambiarVista = (nueva) => {
    setVista(nueva);
    try {
      localStorage.setItem('TAKANA_POS_VISTA', nueva);
    } catch {
      // ignorar
    }
  };

  useEffect(() => {
    const mostrarCatalogo = ({ prods, cats, pagos }) => {
      setProductos(prods.filter((p) => p.presentaciones && p.presentaciones.length > 0));
      setCategorias(cats);
      setMediosPago(pagos);
    };
    const loadData = async () => {
      setErrorCarga('');
      try {
        const [prods, cats, pagos] = await Promise.all([
          api.get('/api/productos'),
          api.get('/api/categorias'),
          api.get('/api/medios-pago'),
        ]);
        mostrarCatalogo({ prods, cats, pagos });
        guardarCatalogo({ prods, cats, pagos });
        setCatalogoGuardadoEn(null);
      } catch (error) {
        console.error('Error cargando datos:', error);
        const guardado = leerCatalogo();
        if (guardado) {
          mostrarCatalogo(guardado);
          setCatalogoGuardadoEn(guardado.guardadoEn);
        } else {
          setErrorCarga(error.message || 'No se pudo cargar el catálogo.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const agregarYResaltar = (prod, ptp) => {
    addToCart({ ...prod, selectedPtp: ptp });
    const key = `${prod.id}-${ptp.id}`;
    setUltimoAgregadoKey(key);
    setAnuncioEscaneo(`Agregado ${prod.nombre} ${ptp.tipo_presentacion?.nombreTipoPresentacion || ''}`);
    setTimeout(() => {
      setUltimoAgregadoKey((prev) => (prev === key ? null : prev));
    }, 900);
  };

  const handleBarcodeScan = (sku) => {
    for (const prod of productos) {
      const ptp = (prod.presentaciones || []).find((p) => p.sku === sku);
      if (ptp) {
        reproducirBeepEscaneo(true);
        agregarYResaltar(prod, ptp);
        return;
      }
    }
    reproducirBeepEscaneo(false);
    setScannedSku(sku);
    setIsProductModalOpen(true);
  };

  const handleCameraScan = (sku) => {
    setIsCameraScannerOpen(false);
    handleBarcodeScan(sku);
  };

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

  const handleProductClick = (prod) => {
    if (!prod.presentaciones || prod.presentaciones.length === 0) return;
    if (prod.presentaciones.length === 1) {
      agregarYResaltar(prod, prod.presentaciones[0]);
    } else {
      setPresentacionModal(prod);
    }
  };

  const handleSelectPresentacion = (prod, ptp) => {
    agregarYResaltar(prod, ptp);
    setPresentacionModal(null);
  };

  const openCheckout = () => {
    if (cartItems.length === 0) return;
    const defaultPago = mediosPago.find((m) => m.is_default) || mediosPago[0];
    setSelectedMedioPago(defaultPago?.codMedioPago || null);
    setMontoRecibidoTxt('');
    setIsCheckoutModalOpen(true);
  };

  const medioSeleccionadoObj = mediosPago.find((m) => m.codMedioPago === selectedMedioPago);
  const esEfectivo = /efectivo/i.test(medioSeleccionadoObj?.nombreMedioPago || '');
  const montoRecibido = parseFloat(String(montoRecibidoTxt).replace(/\./g, '').replace(',', '.'));
  const tieneMontoRecibido = esEfectivo && Number.isFinite(montoRecibido) && montoRecibido > 0;
  const vueltoCalculado = tieneMontoRecibido ? montoRecibido - total : null;

  const handleConfirmSale = async () => {
    if (!selectedMedioPago) {
      alert('Seleccioná un medio de pago.');
      return;
    }
    if (cobrando.current) return;
    cobrando.current = true;
    setCobrandoEstado(true);

    const ahoraIso = new Date().toISOString();
    const itemsComprobante = cartItems.map((item) => ({
      nombre: item.nombre,
      presentacion: item.selectedPtp?.tipo_presentacion?.nombreTipoPresentacion || '',
      cantidad: item.cantidad,
      precioUnitario: item.selectedPtp?.precio || 0,
      subtotal: (item.selectedPtp?.precio || 0) * item.cantidad,
    }));

    const venta = {
      idCliente: nuevoIdVenta(),
      fechaRegistro: ahoraIso,
      codMedioPago: selectedMedioPago,
      detalles: cartItems.map((item) => ({
        idProductoTipoPresentacion: item.selectedPtp.id,
        cantidadRegistroPedido: item.cantidad,
        precioUnitario: item.selectedPtp.precio,
      })),
      total,
      usuario: user?.username,
      resumen: cartItems.map((item) => `${formatearCantidad(item.cantidad)} x ${item.nombre}`).join(', '),
    };

    try {
      const resp = await api.post('/api/registros', {
        idCliente: venta.idCliente,
        codMedioPago: venta.codMedioPago,
        detalles: venta.detalles.map(({ idProductoTipoPresentacion, cantidadRegistroPedido }) => ({
          idProductoTipoPresentacion,
          cantidadRegistroPedido,
        })),
      });
      setUltimaVenta({
        nroRegistro: resp?.nroRegistro || null,
        fechaRegistro: resp?.fechaRegistro || ahoraIso,
        vendedor: user?.username,
        medioPago: medioSeleccionadoObj?.nombreMedioPago || '',
        items: itemsComprobante,
        total,
        montoRecibido: tieneMontoRecibido ? montoRecibido : null,
        vuelto: tieneMontoRecibido && vueltoCalculado >= 0 ? vueltoCalculado : null,
        sinConexion: false,
      });
      clearCart();
      setIsCheckoutModalOpen(false);
      setCartExpanded(false);
    } catch (error) {
      if (error.sinConexion) {
        encolarVenta(venta);
        setUltimaVenta({
          nroRegistro: null,
          fechaRegistro: ahoraIso,
          vendedor: user?.username,
          medioPago: medioSeleccionadoObj?.nombreMedioPago || '',
          items: itemsComprobante,
          total,
          montoRecibido: tieneMontoRecibido ? montoRecibido : null,
          vuelto: tieneMontoRecibido && vueltoCalculado >= 0 ? vueltoCalculado : null,
          sinConexion: true,
        });
        clearCart();
        setIsCheckoutModalOpen(false);
        setCartExpanded(false);
        setAviso('Sin conexión: la venta quedó guardada en este equipo y se envía sola cuando vuelva internet.');
        setTimeout(() => setAviso(''), 6000);
      } else {
        alert('Error al registrar la venta: ' + error.message);
      }
    } finally {
      cobrando.current = false;
      setCobrandoEstado(false);
    }
  };

  // Atajos de teclado y lector de código de barras USB/Bluetooth
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (e.key === 'F4' || e.key === 'F9') {
        if (cartItems.length > 0 && !isCheckoutModalOpen && !presentacionModal && !isCameraScannerOpen) {
          e.preventDefault();
          openCheckout();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (isCameraScannerOpen) setIsCameraScannerOpen(false);
        else if (isProductModalOpen) setIsProductModalOpen(false);
        else if (presentacionModal) setPresentacionModal(null);
        else if (isCheckoutModalOpen) setIsCheckoutModalOpen(false);
        else if (ultimaVenta) setUltimaVenta(null);
        return;
      }

      if (e.target.tagName === 'INPUT' && e.target.id !== 'search-input') {
        if (e.key === 'Enter' && isCheckoutModalOpen) {
          e.preventDefault();
          handleConfirmSale();
        }
        return;
      }

      const now = Date.now();
      if (e.key === 'Enter' && e.target.id === 'search-input') {
        const codigo = e.target.value.trim();
        const esCodigo =
          codigo !== '' && productos.some((p) => (p.presentaciones || []).some((pp) => pp.sku === codigo));
        if (esCodigo) {
          handleBarcodeScan(codigo);
          barcodeBuffer.current = '';
          e.preventDefault();
          setSearchTerm('');
          lastKeyTime.current = now;
          return;
        }
      }

      if (now - lastKeyTime.current > 50) barcodeBuffer.current = '';
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 2) {
          handleBarcodeScan(barcodeBuffer.current);
          barcodeBuffer.current = '';
          e.preventDefault();
          if (e.target.id === 'search-input') setSearchTerm('');
        } else if (isCheckoutModalOpen) {
          e.preventDefault();
          handleConfirmSale();
        } else if (cartItems.length > 0 && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          openCheckout();
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        barcodeBuffer.current += e.key;
      }
      lastKeyTime.current = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const matchCat = (p) =>
    selectedCategory ? (p.categorias_asociadas || []).some((c) => c.codCategoria === selectedCategory) : true;

  const filteredProducts =
    busqueda && busqueda.ids.length > 0
      ? ordenarPorBusqueda(productos, busqueda).filter(matchCat)
      : productos.filter((p) => {
          const term = searchTerm.trim().toLowerCase();
          const matchSearch =
            !term ||
            p.nombre.toLowerCase().includes(term) ||
            (p.presentaciones || []).some((pp) => pp.sku && pp.sku.toLowerCase().includes(term));
          return matchSearch && matchCat(p);
        });

  const totalUnidades = cartItems.reduce((acc, item) => acc + item.cantidad, 0);

  const vaciarCarrito = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('¿Vaciar todos los productos del ticket en curso?')) {
      clearCart();
    }
  };

  const handleCopiarTicket = async () => {
    if (!ultimaVenta) return;
    const ok = await copiarTicket(ultimaVenta);
    if (ok) {
      setTicketCopiado(true);
      setTimeout(() => setTicketCopiado(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Región accesible para lectores de pantalla */}
      <div className="sr-only" aria-live="polite">
        {anuncioEscaneo}
      </div>

      {catalogoGuardadoEn && (
        <div
          role="status"
          className="mx-3 md:mx-4 mt-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 text-xs font-medium"
        >
          Sin conexión: se muestran los productos y precios guardados en este equipo (
          {new Date(catalogoGuardadoEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}).
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-50 w-[calc(100%-2rem)] max-w-md px-4 py-3 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-slate-800 text-amber-950 dark:text-amber-100 text-sm font-medium shadow-md"
        >
          {aviso}
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 p-3 md:p-4 gap-3 md:gap-4 overflow-hidden pb-20 lg:pb-4">
        {/* COLUMNA IZQUIERDA: BÚSQUEDA Y CATÁLOGO */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          {/* Buscador + Filtros */}
          <div className="surface-card p-3 md:p-4 flex flex-col gap-3 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                  size={18}
                />
                <input
                  id="search-input"
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar producto o escanear código de barras…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded-lg pl-10 pr-20 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-brand-700 dark:focus:ring-brand-400"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Limpiar búsqueda"
                      className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded">
                    F2
                  </kbd>
                </div>
              </div>

              <button
                type="button"
                onClick={openScanner}
                title="Escanear con la cámara"
                aria-label="Escanear código con la cámara"
                className="shrink-0 h-11 px-3.5 btn-brand flex items-center justify-center gap-2 text-sm"
              >
                <Camera size={19} />
                <span className="hidden sm:inline">Cámara</span>
              </button>

              <div className="hidden sm:flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => cambiarVista('cuadricula')}
                  aria-label="Vista en cuadrícula"
                  title="Vista en cuadrícula"
                  className={`h-11 px-2.5 flex items-center justify-center transition-colors ${
                    vista === 'cuadricula'
                      ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => cambiarVista('lista')}
                  aria-label="Vista en lista"
                  title="Vista en lista"
                  className={`h-11 px-2.5 flex items-center justify-center border-l border-slate-300 dark:border-slate-600 transition-colors ${
                    vista === 'lista'
                      ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <List size={18} />
                </button>
              </div>
            </div>

            <AvisoBusqueda resultado={busqueda} />

            {/* Categorías */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`whitespace-nowrap px-3 min-h-[36px] rounded-md text-xs font-semibold border transition-colors ${
                  !selectedCategory
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Todos ({productos.length})
              </button>
              {categorias.map((cat) => (
                <button
                  type="button"
                  key={cat.codCategoria}
                  onClick={() => setSelectedCategory(cat.codCategoria)}
                  className={`whitespace-nowrap px-3 min-h-[36px] rounded-md text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                    selectedCategory === cat.codCategoria
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Tag size={12} />
                  {cat.nombreCategoria}
                </button>
              ))}
            </div>
          </div>

          {/* Lista / Grilla de productos */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
            {isLoading ? (
              <div className="surface-card flex flex-col items-center justify-center h-64 text-slate-600 dark:text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Cargando productos...</p>
              </div>
            ) : errorCarga ? (
              <div className="surface-card flex flex-col items-center justify-center h-64 text-center p-6 gap-2">
                <AlertCircle size={36} className="text-red-700 dark:text-red-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No se pudo cargar el catálogo
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{errorCarga}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="surface-card flex flex-col items-center justify-center h-64 text-center p-6 gap-3">
                <Package size={40} className="text-slate-400 dark:text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No se encontraron productos
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Probá con otro nombre o quitá los filtros activos.
                  </p>
                </div>
                {(searchTerm || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory(null);
                    }}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : vista === 'lista' ? (
              <div className="surface-card divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                      {prod.imgUrlProducto ? (
                        <img
                          src={`${getApiUrl()}${prod.imgUrlProducto}`}
                          alt={prod.nombre}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {prod.nombre}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(prod.presentaciones || []).map((ptp) => (
                          <button
                            key={ptp.id}
                            type="button"
                            onClick={() => agregarYResaltar(prod, ptp)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-brand-700 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-xs transition-colors"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {ptp.tipo_presentacion?.nombreTipoPresentacion}
                            </span>
                            <span className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                              {formatearPesos(ptp.precio)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-2.5 md:gap-3">
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleProductClick(prod)}
                    className="surface-card text-left overflow-hidden flex flex-col hover:border-brand-700 dark:hover:border-brand-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700 group"
                  >
                    <div className="h-24 w-full bg-slate-100 dark:bg-slate-700/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {prod.imgUrlProducto ? (
                        <img
                          src={`${getApiUrl()}${prod.imgUrlProducto}`}
                          alt={prod.nombre}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={28} className="text-slate-400 dark:text-slate-500" />
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between w-full gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                          {prod.nombre}
                        </h3>
                        <div className="mt-1.5 space-y-0.5">
                          {(prod.presentaciones || []).slice(0, 2).map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-600 dark:text-slate-400 truncate">
                                {p.tipo_presentacion?.nombreTipoPresentacion}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                                {formatearPesos(p.precio)}
                              </span>
                            </div>
                          ))}
                          {(prod.presentaciones || []).length > 2 && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              +{prod.presentaciones.length - 2} presentaciones
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-xs font-semibold text-brand-700 dark:text-brand-300">
                        <span>{prod.presentaciones.length > 1 ? 'Elegir opción' : 'Agregar'}</span>
                        {prod.presentaciones.length > 1 ? <ChevronRight size={15} /> : <Plus size={15} />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (DESKTOP): TICKET EN CURSO */}
        <aside
          aria-label="Ticket de venta en curso"
          className={`
            ${cartExpanded ? 'fixed inset-x-0 bottom-[53px] z-40 max-h-[75vh] flex shadow-2xl' : 'hidden lg:flex'}
            lg:static lg:w-[400px] xl:w-[440px] lg:max-h-none shrink-0 flex-col surface-card overflow-hidden
          `}
        >
          {/* Cabecera del ticket */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-brand-700 dark:text-brand-400" size={19} />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Ticket en curso</h2>
              {cartItems.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-950 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-800 tabular-nums">
                  {cartItems.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={vaciarCarrito}
                  className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline px-2 py-1"
                >
                  Vaciar
                </button>
              )}
              <button
                type="button"
                onClick={() => setCartExpanded(false)}
                aria-label="Cerrar ticket"
                className="lg:hidden p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Comprobante de última venta (no bloqueante) */}
          {ultimaVenta && (
            <div
              role="status"
              className="m-3 mb-0 p-3 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-950 dark:text-green-100 shrink-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-700 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">
                      {ultimaVenta.sinConexion
                        ? 'Venta guardada sin conexión'
                        : `Venta registrada${ultimaVenta.nroRegistro ? ` #${ultimaVenta.nroRegistro}` : ''}`}
                    </p>
                    <p className="text-xs tabular-nums text-green-800 dark:text-green-200">
                      {formatearPesos(ultimaVenta.total)} · {ultimaVenta.medioPago}
                      {ultimaVenta.vuelto > 0 ? ` · Vuelto ${formatearPesos(ultimaVenta.vuelto)}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUltimaVenta(null)}
                  aria-label="Cerrar aviso de venta"
                  className="p-1 rounded text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <button
                  type="button"
                  onClick={() => imprimirTicket(ultimaVenta)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-green-400 dark:border-green-700 text-xs font-semibold text-green-900 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/40"
                >
                  <Printer size={13} /> Imprimir ticket
                </button>
                <button
                  type="button"
                  onClick={() => compartirWhatsApp(ultimaVenta)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-green-400 dark:border-green-700 text-xs font-semibold text-green-900 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/40"
                >
                  <Share2 size={13} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleCopiarTicket}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-green-400 dark:border-green-700 text-xs font-semibold text-green-900 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/40"
                >
                  {ticketCopiado ? <Check size={13} /> : <Copy size={13} />}
                  {ticketCopiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de renglones */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center text-slate-500 dark:text-slate-400 px-4">
                <ShoppingCart size={34} className="mb-2 opacity-40" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">El ticket está vacío</p>
                <p className="text-xs mt-1">Escaneá un código de barras o seleccioná un producto del catálogo.</p>
              </div>
            ) : (
              cartItems.map((item) => {
                const key = `${item.id}-${item.selectedPtp?.id}`;
                const resaltado = ultimoAgregadoKey === key;
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border transition-colors ${
                      resaltado
                        ? 'bg-brand-50 dark:bg-brand-950/50 border-brand-600 dark:border-brand-400'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug truncate">
                          {item.nombre}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
                          {item.selectedPtp?.tipo_presentacion?.nombreTipoPresentacion} ·{' '}
                          {formatearPesos(item.selectedPtp?.precio)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatearPesos((item.selectedPtp?.precio || 0) * item.cantidad)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(key)}
                          aria-label={`Quitar ${item.nombre}`}
                          className="p-1.5 rounded text-slate-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <CantidadTicket
                      cantidad={item.cantidad}
                      precio={item.selectedPtp?.precio}
                      presentacion={item.selectedPtp?.tipo_presentacion?.nombreTipoPresentacion}
                      onCambiar={(v) => updateQuantity(key, v)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Pie de cobro fijo */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 shrink-0 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Total a cobrar
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatearCantidad(totalUnidades)} {totalUnidades === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>
              <span className="text-3xl xl:text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatearPesos(total)}
              </span>
            </div>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={openCheckout}
              className="w-full min-h-[50px] px-4 btn-brand text-base flex items-center justify-center gap-2"
            >
              <CreditCard size={20} />
              <span>Cobrar</span>
              <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[11px] font-mono bg-brand-800 text-brand-100 rounded border border-brand-600">
                Enter / F9
              </kbd>
            </button>
          </div>
        </aside>
      </div>

      {/* BARRA INFERIOR FIJA DE TICKET EN MÓVIL / TABLET (< lg) */}
      <div className="lg:hidden fixed inset-x-0 bottom-[53px] z-30 bg-white dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 px-3 py-2 flex items-center justify-between gap-3 shadow-md">
        <button
          type="button"
          onClick={() => setCartExpanded((v) => !v)}
          className="flex items-center gap-2 min-h-[44px] text-left min-w-0"
        >
          <div className="relative shrink-0 p-2 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <ShoppingCart size={18} />
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 rounded-full text-[10px] font-bold bg-brand-700 text-white tabular-nums">
                {cartItems.length}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
              {cartExpanded ? 'Ocultar ticket' : 'Ver ticket'}
              <ChevronUp size={13} className={cartExpanded ? 'rotate-180 transition-transform' : ''} />
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums block leading-tight">
              {formatearPesos(total)}
            </span>
          </div>
        </button>

        <button
          type="button"
          disabled={cartItems.length === 0}
          onClick={openCheckout}
          className="min-h-[44px] px-5 btn-brand text-sm flex items-center gap-2 shrink-0"
        >
          <CreditCard size={18} />
          Cobrar
        </button>
      </div>

      {/* MODAL: SELECCIÓN DE PRESENTACIÓN */}
      {presentacionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-presentacion-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="surface-card w-full max-w-sm shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="min-w-0 pr-2">
                <h3 id="modal-presentacion-titulo" className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {presentacionModal.nombre}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Seleccioná una presentación</p>
              </div>
              <button
                type="button"
                onClick={() => setPresentacionModal(null)}
                aria-label="Cerrar"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto">
              {(presentacionModal.presentaciones || []).map((ptp) => (
                <button
                  key={ptp.id}
                  type="button"
                  onClick={() => handleSelectPresentacion(presentacionModal, ptp)}
                  className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-brand-700 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                >
                  <span className="text-slate-900 dark:text-slate-100 font-medium text-sm">
                    {ptp.tipo_presentacion?.nombreTipoPresentacion}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-700 dark:text-brand-300 font-bold tabular-nums">
                      {formatearPesos(ptp.precio)}
                    </span>
                    <Plus size={16} className="text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT / COBRO */}
      {isCheckoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cobro-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="surface-card w-full max-w-md shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 id="modal-cobro-titulo" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Cobrar venta
              </h2>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Total a cobrar
                </span>
                <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                  {formatearPesos(total)}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 block">
                  Medio de pago
                </span>
                <div className="space-y-2">
                  {mediosPago.map((mp) => {
                    const activo = selectedMedioPago === mp.codMedioPago;
                    return (
                      <button
                        key={mp.codMedioPago}
                        type="button"
                        onClick={() => setSelectedMedioPago(mp.codMedioPago)}
                        className={`w-full min-h-[46px] flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors text-left ${
                          activo
                            ? 'bg-brand-50 dark:bg-brand-950/50 border-brand-700 dark:border-brand-400 text-brand-900 dark:text-brand-100 font-semibold'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <CreditCard
                          size={18}
                          className={activo ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400'}
                        />
                        <span className="text-sm">{mp.nombreMedioPago}</span>
                        {mp.is_default && (
                          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/50 border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300">
                            Predeterminado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {esEfectivo && (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="monto-recibido-input"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Con cuánto paga (opcional)
                    </label>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <input
                        id="monto-recibido-input"
                        type="text"
                        inputMode="decimal"
                        value={montoRecibidoTxt}
                        onChange={(e) => setMontoRecibidoTxt(e.target.value)}
                        placeholder={String(Math.ceil(total))}
                        className="w-full h-9 pl-7 pr-2.5 text-right rounded-md bg-white dark:bg-slate-800 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-700"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMontoRecibidoTxt(String(Number(total.toFixed(2))))}
                      className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Exacto
                    </button>
                    {BILLETES_RAPIDOS.map((billete) => (
                      <button
                        key={billete}
                        type="button"
                        onClick={() => setMontoRecibidoTxt(String(billete))}
                        className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 tabular-nums"
                      >
                        {formatearPesos(billete).replace(',00', '')}
                      </button>
                    ))}
                  </div>

                  {tieneMontoRecibido && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {vueltoCalculado >= 0 ? 'Vuelto a entregar' : 'Falta cubrir'}
                      </span>
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          vueltoCalculado >= 0
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {formatearPesos(Math.abs(vueltoCalculado))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 min-h-[46px] btn-secondary text-sm"
              >
                Cancelar (Esc)
              </button>
              <button
                type="button"
                disabled={cobrandoEstado}
                onClick={handleConfirmSale}
                autoFocus
                className="flex-1 min-h-[46px] btn-brand text-sm"
              >
                {cobrandoEstado ? 'Registrando...' : 'Confirmar (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESCÁNER DE CÁMARA */}
      {isCameraScannerOpen && (
        <BarcodeScannerModal onScan={handleCameraScan} onClose={() => setIsCameraScannerOpen(false)} />
      )}

      {/* MODAL: CÓDIGO NO RECONOCIDO */}
      {isProductModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-sku-desconocido"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="surface-card p-6 w-full max-w-sm shadow-xl space-y-4">
            <h2 id="modal-sku-desconocido" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Código no reconocido
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              El código{' '}
              <strong className="text-slate-900 dark:text-slate-100 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                {scannedSku}
              </strong>{' '}
              no está asignado a ningún producto. Crealo o asignalo desde la sección Productos.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setIsProductModalOpen(false)}
              className="w-full min-h-[44px] btn-brand text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
