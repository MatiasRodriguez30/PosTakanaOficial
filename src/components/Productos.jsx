import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { api, getApiUrl } from '../api';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Upload,
  Tag,
  Trash,
  ScanLine,
  Printer,
  AlertCircle,
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import CampoCodigoBarras from './CampoCodigoBarras';
import { formatearPesos, reproducirBeepEscaneo } from '../formato';

const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Code93,
  BarcodeFormat.Itf, BarcodeFormat.Codabar, BarcodeFormat.QrCode,
];

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [orden, setOrden] = useState('nombre-asc');

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef();
  const [previewImg, setPreviewImg] = useState(null);
  const [scanningIdx, setScanningIdx] = useState(null);

  const emptyForm = { nombre: '', categorias: [], presentacionesPrecios: [], imagen: null };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showModal && scanningIdx === null) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, scanningIdx]);

  const fetchAll = async () => {
    setLoading(true);
    setErrorCarga('');
    try {
      const [prods, cats, pres] = await Promise.all([
        api.get('/api/productos'),
        api.get('/api/categorias'),
        api.get('/api/presentaciones'),
      ]);
      setProductos(prods);
      setCategorias(cats);
      setPresentaciones(pres);
    } catch (e) {
      console.error(e);
      setErrorCarga(e.message || 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setPreviewImg(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (prod) => {
    setEditingProduct(prod);
    setForm({
      nombre: prod.nombre,
      categorias: (prod.categorias_asociadas || []).map((c) => c.codCategoria),
      presentacionesPrecios: (prod.presentaciones || []).map((p) => ({
        codTipoPresentacion: p.codTipoPresentacion,
        precio: p.precio,
        sku: p.sku || '',
      })),
      imagen: null,
    });
    setPreviewImg(prod.imgUrlProducto ? `${getApiUrl()}${prod.imgUrlProducto}` : null);
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (prod) => {
    if (!window.confirm(`¿Dar de baja "${prod.nombre}"? Las ventas anteriores conservarán el registro.`)) return;
    try {
      await api.delete(`/api/productos/${prod.id}`);
      await fetchAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((f) => ({ ...f, imagen: file }));
      setPreviewImg(URL.createObjectURL(file));
    }
  };

  const toggleCategoria = (cod) => {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(cod) ? f.categorias.filter((c) => c !== cod) : [...f.categorias, cod],
    }));
  };

  const addPresentacion = () => {
    const disponibles = presentaciones.filter(
      (p) => !form.presentacionesPrecios.some((pp) => pp.codTipoPresentacion === p.codTipoPresentacion)
    );
    if (!disponibles.length) return;
    setForm((f) => ({
      ...f,
      presentacionesPrecios: [
        ...f.presentacionesPrecios,
        { codTipoPresentacion: disponibles[0].codTipoPresentacion, precio: '', sku: '' },
      ],
    }));
  };

  const updatePresentacion = (idx, field, value) => {
    setForm((f) => {
      const list = [...f.presentacionesPrecios];
      list[idx] = { ...list[idx], [field]: value };
      return { ...f, presentacionesPrecios: list };
    });
  };

  const removePresentacion = (idx) => {
    setForm((f) => ({ ...f, presentacionesPrecios: f.presentacionesPrecios.filter((_, i) => i !== idx) }));
  };

  const handleScanSku = async (idx) => {
    if (!Capacitor.isNativePlatform()) {
      setScanningIdx(idx);
      return;
    }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: NATIVE_SCAN_FORMATS });
      if (barcodes && barcodes.length > 0) {
        reproducirBeepEscaneo(true);
        updatePresentacion(idx, 'sku', barcodes[0].rawValue);
      }
    } catch (err) {
      alert('No se pudo usar la cámara: ' + (err.message || err));
    }
  };

  const handleWebScanResult = (value) => {
    if (scanningIdx !== null) {
      reproducirBeepEscaneo(true);
      updatePresentacion(scanningIdx, 'sku', value);
    }
    setScanningIdx(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (form.presentacionesPrecios.length === 0) {
      setError('Agregá al menos una presentación con precio.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nombre', form.nombre.trim());
      fd.append('categorias', form.categorias.join(','));
      fd.append(
        'presentaciones',
        JSON.stringify(
          form.presentacionesPrecios.map((p) => ({
            codTipoPresentacion: parseInt(p.codTipoPresentacion, 10),
            precio: parseFloat(p.precio) || 0,
            sku: (p.sku || '').trim() || null,
          }))
        )
      );
      if (form.imagen) fd.append('imagen', form.imagen);
      else if (editingProduct && previewImg) fd.append('imgUrlExistente', editingProduct.imgUrlProducto || '');

      if (editingProduct) await api.upload(`/api/productos/${editingProduct.id}`, fd, true);
      else await api.upload('/api/productos', fd);

      setShowModal(false);
      await fetchAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Escanear con el lector (USB o Bluetooth) busca el producto o abre su edición
  // enfocando el precio de esa presentación puntual.
  const buscadorRef = useRef(null);
  const teclasEscaneo = useRef({ texto: '', ultima: 0 });
  useEffect(() => {
    if (showModal || scanningIdx !== null) return undefined;
    const alTeclear = (e) => {
      const destino = e.target;
      if (destino === buscadorRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          destino.select();
          abrirPorCodigo(destino.value.trim());
        }
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName) || destino.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ahora = Date.now();
      const escaneo = teclasEscaneo.current;
      if (ahora - escaneo.ultima > 1500) escaneo.texto = '';
      escaneo.ultima = ahora;
      if (e.key === 'Enter') {
        if (escaneo.texto.trim().length >= 3) {
          e.preventDefault();
          const codigo = escaneo.texto.trim();
          setSearch(codigo);
          if (!abrirPorCodigo(codigo)) {
            requestAnimationFrame(() => {
              buscadorRef.current?.focus();
              buscadorRef.current?.select();
            });
          }
        }
        escaneo.texto = '';
      } else if (e.key.length === 1) {
        escaneo.texto += e.key;
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [showModal, scanningIdx, productos]);

  const abrirPorCodigo = (codigo) => {
    if (!codigo) return false;
    const coincidencias = productos.filter((p) => (p.presentaciones || []).some((pp) => pp.sku === codigo));
    if (coincidencias.length !== 1) return false;
    reproducirBeepEscaneo(true);
    openEdit(coincidencias[0]);
    setTimeout(() => {
      const precio = document.querySelector(`input[data-sku="${CSS.escape(codigo)}"]`);
      if (precio) {
        precio.focus();
        precio.select();
      }
    }, 50);
    return true;
  };

  const [generandoEtiquetas, setGenerandoEtiquetas] = useState(false);
  const descargarEtiquetas = async () => {
    setGenerandoEtiquetas(true);
    try {
      const token = localStorage.getItem('TAKANA_TOKEN');
      const respuesta = await fetch(`${getApiUrl()}/api/productos/etiquetas-internas.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!respuesta.ok) throw new Error(`No se pudo generar el PDF (HTTP ${respuesta.status})`);
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'etiquetas-codigos-internos.pdf';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      fetchAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerandoEtiquetas(false);
    }
  };

  const filtered = productos
    .filter((p) => {
      const term = search.trim().toLowerCase();
      const matchSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.presentaciones || []).some((pp) => (pp.sku || '').toLowerCase().includes(term));
      const matchCat =
        !categoriaFiltro ||
        (p.categorias_asociadas || []).some((c) => String(c.codCategoria) === String(categoriaFiltro));
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (orden === 'nombre-desc') return b.nombre.localeCompare(a.nombre, 'es');
      if (orden === 'pres-desc') return (b.presentaciones?.length || 0) - (a.presentaciones?.length || 0);
      return a.nombre.localeCompare(b.nombre, 'es');
    });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabecera */}
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Package className="text-brand-700 dark:text-brand-400" size={22} />
            Productos
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-0.5 tabular-nums">
            {productos.length} {productos.length === 1 ? 'producto activo' : 'productos activos'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!Capacitor.isNativePlatform() && (
            <button
              type="button"
              onClick={descargarEtiquetas}
              disabled={generandoEtiquetas}
              title="PDF para imprimir las etiquetas de los productos con código interno"
              className="btn-secondary min-h-[42px] px-3.5 text-xs md:text-sm flex items-center gap-2"
            >
              <Printer size={16} />
              <span>{generandoEtiquetas ? 'Generando…' : 'Etiquetas (PDF)'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="btn-brand min-h-[42px] px-4 text-xs md:text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filtros y contenido */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              ref={buscadorRef}
              type="text"
              placeholder="Buscar por nombre o código, o escaneá con el lector…"
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

          <select
            aria-label="Filtrar por categoría"
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.codCategoria} value={c.codCategoria}>
                {c.nombreCategoria}
              </option>
            ))}
          </select>

          <select
            aria-label="Ordenar productos"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="h-10 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="nombre-asc">Nombre (A–Z)</option>
            <option value="nombre-desc">Nombre (Z–A)</option>
            <option value="pres-desc">Más presentaciones</option>
          </select>
        </div>

        {loading ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-slate-600 dark:text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando productos...</p>
          </div>
        ) : errorCarga ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-center p-6 gap-3">
            <AlertCircle size={36} className="text-red-700 dark:text-red-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{errorCarga}</p>
            <button type="button" onClick={fetchAll} className="btn-secondary px-4 py-2 text-xs">
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center py-16 text-center p-6 gap-3">
            <Package size={38} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {productos.length === 0 ? 'Todavía no hay productos cargados.' : 'No hay productos que coincidan con el filtro.'}
            </p>
            {productos.length === 0 ? (
              <button type="button" onClick={openCreate} className="btn-brand px-4 py-2 text-xs">
                Crear primer producto
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoriaFiltro('');
                }}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tabla densa en escritorio (md+) */}
            <div className="hidden md:block surface-card overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4 font-semibold">Producto</th>
                    <th className="py-3 px-4 font-semibold">Categorías</th>
                    <th className="py-3 px-4 font-semibold">Presentaciones y precios</th>
                    <th className="py-3 px-4 font-semibold">Códigos SKU</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filtered.map((prod) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors align-top"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.imgUrlProducto ? (
                              <img
                                src={`${getApiUrl()}${prod.imgUrlProducto}`}
                                alt={prod.nombre}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package size={18} className="text-slate-400" />
                            )}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{prod.nombre}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {(prod.categorias_asociadas || []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {prod.categorias_asociadas.map((c) => (
                              <span
                                key={c.codCategoria}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                              >
                                {c.categoria?.nombreCategoria || ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1 max-w-xs">
                          {(prod.presentaciones || []).map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-slate-700 dark:text-slate-300 font-medium">
                                {p.tipo_presentacion?.nombreTipoPresentacion}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                {formatearPesos(p.precio)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {(prod.presentaciones || []).map((p) => (
                            <div key={p.id}>{p.sku || '—'}</div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(prod)}
                            title="Editar producto"
                            aria-label={`Editar ${prod.nombre}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(prod)}
                            title="Dar de baja"
                            aria-label={`Dar de baja ${prod.nombre}`}
                            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista compacta de dos líneas en móvil (< md) */}
            <div className="md:hidden surface-card divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
              {filtered.map((prod) => (
                <div key={prod.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{prod.nombre}</h3>
                      {(prod.categorias_asociadas || []).length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {prod.categorias_asociadas.map((c) => c.categoria?.nombreCategoria).filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(prod)}
                        aria-label={`Editar ${prod.nombre}`}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prod)}
                        aria-label={`Dar de baja ${prod.nombre}`}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700/70">
                    {(prod.presentaciones || []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-700 dark:text-slate-300">
                          {p.tipo_presentacion?.nombreTipoPresentacion}
                          {p.sku && (
                            <span className="ml-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {p.sku}
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                          {formatearPesos(p.precio)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-producto-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="surface-card w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h2 id="modal-producto-titulo" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              {/* Imagen */}
              <div
                onClick={() => fileInputRef.current.click()}
                className="h-28 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-brand-700 dark:hover:border-brand-400 cursor-pointer transition-colors flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900"
              >
                {previewImg ? (
                  <img src={previewImg} alt="Vista previa" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    <Upload size={22} className="mx-auto mb-1" />
                    <p className="text-xs font-medium">Tocá para subir una imagen (opcional)</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              <div>
                <label htmlFor="prod-nombre" className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Nombre del producto *
                </label>
                <input
                  id="prod-nombre"
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="input-base"
                />
              </div>

              {/* Presentaciones + Precios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Presentaciones y precios *
                  </label>
                  <button
                    type="button"
                    onClick={addPresentacion}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
                  >
                    <Plus size={13} /> Agregar presentación
                  </button>
                </div>

                {form.presentacionesPrecios.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-xs text-center py-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    Sin presentaciones. Hacé clic en «Agregar presentación».
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.presentacionesPrecios.map((pp, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            aria-label="Tipo de presentación"
                            value={pp.codTipoPresentacion}
                            onChange={(e) => updatePresentacion(idx, 'codTipoPresentacion', parseInt(e.target.value, 10))}
                            className="flex-1 h-9 px-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
                          >
                            {presentaciones.map((p) => (
                              <option key={p.codTipoPresentacion} value={p.codTipoPresentacion}>
                                {p.nombreTipoPresentacion}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 rounded-md px-2 h-9">
                            <span className="text-slate-500 text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label="Precio"
                              value={pp.precio}
                              data-sku={pp.sku || ''}
                              onChange={(e) => updatePresentacion(idx, 'precio', e.target.value)}
                              className="w-24 bg-transparent text-slate-900 dark:text-slate-100 text-sm font-semibold text-right tabular-nums focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePresentacion(idx)}
                            aria-label="Quitar presentación"
                            className="p-2 text-slate-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash size={15} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <CampoCodigoBarras
                            valor={pp.sku || ''}
                            onCambiar={(codigo) => updatePresentacion(idx, 'sku', codigo)}
                          />
                          <button
                            type="button"
                            onClick={() => handleScanSku(idx)}
                            title="Escanear código de barras con cámara"
                            aria-label="Escanear código de barras con cámara"
                            className="shrink-0 h-[38px] px-2.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors flex items-center justify-center"
                          >
                            <ScanLine size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categorías */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                  <Tag size={12} /> Categorías
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((cat) => {
                    const marcada = form.categorias.includes(cat.codCategoria);
                    return (
                      <button
                        type="button"
                        key={cat.codCategoria}
                        onClick={() => toggleCategoria(cat.codCategoria)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          marcada
                            ? 'bg-brand-700 border-brand-700 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {cat.nombreCategoria}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-red-800 dark:text-red-200 text-xs font-medium bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 min-h-[44px] btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 min-h-[44px] btn-brand text-sm">
                  {saving ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scanningIdx !== null && (
        <BarcodeScannerModal onScan={handleWebScanResult} onClose={() => setScanningIdx(null)} />
      )}
    </div>
  );
}
