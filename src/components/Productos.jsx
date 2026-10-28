import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { api } from '../api';
import { Package, Plus, Search, Edit2, Trash2, X, Upload, Tag, Trash, ScanLine, Printer } from 'lucide-react';
import { getApiUrl } from '../api';
import BarcodeScannerModal from './BarcodeScannerModal';
import CampoCodigoBarras from './CampoCodigoBarras';

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
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef();
  const [previewImg, setPreviewImg] = useState(null);
  const [scanningIdx, setScanningIdx] = useState(null); // índice de presentación siendo escaneada (modal web)

  const emptyForm = { nombre: '', categorias: [], presentacionesPrecios: [], imagen: null };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prods, cats, pres] = await Promise.all([
        api.get('/api/productos'),
        api.get('/api/categorias'),
        api.get('/api/presentaciones'),
      ]);
      setProductos(prods);
      setCategorias(cats);
      setPresentaciones(pres);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
      categorias: (prod.categorias_asociadas || []).map(c => c.codCategoria),
      presentacionesPrecios: (prod.presentaciones || []).map(p => ({
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

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try { await api.delete(`/api/productos/${id}`); await fetchAll(); }
    catch (e) { alert(e.message); }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setForm(f => ({ ...f, imagen: file })); setPreviewImg(URL.createObjectURL(file)); }
  };

  const toggleCategoria = (cod) => {
    setForm(f => ({
      ...f,
      categorias: f.categorias.includes(cod) ? f.categorias.filter(c => c !== cod) : [...f.categorias, cod]
    }));
  };

  const addPresentacion = () => {
    const disponibles = presentaciones.filter(p => !form.presentacionesPrecios.some(pp => pp.codTipoPresentacion === p.codTipoPresentacion));
    if (!disponibles.length) return;
    setForm(f => ({ ...f, presentacionesPrecios: [...f.presentacionesPrecios, { codTipoPresentacion: disponibles[0].codTipoPresentacion, precio: '', sku: '' }] }));
  };

  const updatePresentacion = (idx, field, value) => {
    setForm(f => {
      const list = [...f.presentacionesPrecios];
      list[idx] = { ...list[idx], [field]: value };
      return { ...f, presentacionesPrecios: list };
    });
  };

  const removePresentacion = (idx) => {
    setForm(f => ({ ...f, presentacionesPrecios: f.presentacionesPrecios.filter((_, i) => i !== idx) }));
  };

  // Escanear el código de barras de una presentación puntual (cámara nativa en la
  // app Android, o el modal con html5-qrcode si estamos en el navegador).
  const handleScanSku = async (idx) => {
    if (!Capacitor.isNativePlatform()) {
      setScanningIdx(idx);
      return;
    }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: NATIVE_SCAN_FORMATS });
      if (barcodes && barcodes.length > 0) updatePresentacion(idx, 'sku', barcodes[0].rawValue);
    } catch (err) {
      alert('No se pudo usar la cámara: ' + (err.message || err));
    }
  };

  const handleWebScanResult = (value) => {
    if (scanningIdx !== null) updatePresentacion(scanningIdx, 'sku', value);
    setScanningIdx(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (form.presentacionesPrecios.length === 0) { setError('Agregá al menos una presentación con precio.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nombre', form.nombre.trim());
      fd.append('categorias', form.categorias.join(','));
      fd.append('presentaciones', JSON.stringify(
        form.presentacionesPrecios.map(p => ({
          codTipoPresentacion: parseInt(p.codTipoPresentacion),
          precio: parseFloat(p.precio) || 0,
          sku: (p.sku || '').trim() || null,
        }))
      ));
      if (form.imagen) fd.append('imagen', form.imagen);
      else if (editingProduct && previewImg) fd.append('imgUrlExistente', editingProduct.imgUrlProducto || '');

      if (editingProduct) await api.upload(`/api/productos/${editingProduct.id}`, fd, true);
      else await api.upload('/api/productos', fd);

      setShowModal(false);
      await fetchAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // Escanear con el lector (USB o Bluetooth, escribe el código y manda Enter)
  // busca el producto sin tener que tocar el buscador. Con el formulario
  // abierto no hace nada: ahí manda el campo del código de barras.
  const buscadorRef = useRef(null);
  const teclasEscaneo = useRef({ texto: '', ultima: 0 });
  useEffect(() => {
    if (showModal || scanningIdx !== null) return undefined;
    const alTeclear = (e) => {
      const destino = e.target;
      if (destino === buscadorRef.current) {
        // Un código por consulta: con el Enter se selecciona todo y el próximo escaneo lo reemplaza.
        if (e.key === 'Enter') { e.preventDefault(); destino.select(); abrirPorCodigo(destino.value.trim()); }
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
            requestAnimationFrame(() => { buscadorRef.current?.focus(); buscadorRef.current?.select(); });
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

  // Si el código escaneado es de un solo producto, abre su edición con el
  // precio de esa presentación listo para cambiar (actualizar precios
  // escaneando). Devuelve true si lo abrió.
  const abrirPorCodigo = (codigo) => {
    if (!codigo) return false;
    const coincidencias = productos.filter(p => (p.presentaciones || []).some(pp => pp.sku === codigo));
    if (coincidencias.length !== 1) return false;
    openEdit(coincidencias[0]);
    setTimeout(() => {
      const precio = document.querySelector(`input[data-sku="${CSS.escape(codigo)}"]`);
      if (precio) { precio.focus(); precio.select(); }
    }, 50);
    return true;
  };

  // PDF con las etiquetas de todos los códigos internos (A4 horizontal).
  const [generandoEtiquetas, setGenerandoEtiquetas] = useState(false);
  const descargarEtiquetas = async () => {
    setGenerandoEtiquetas(true);
    try {
      const token = localStorage.getItem('TAKANA_TOKEN');
      const respuesta = await fetch(`${getApiUrl()}/api/productos/etiquetas-internas.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
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
      fetchAll();  // pudieron asignarse códigos nuevos
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerandoEtiquetas(false);
    }
  };

  const filtered = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.presentaciones || []).some(pp => (pp.sku || '').toLowerCase().includes(search.toLowerCase()))
  );

  const inputCls = "w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Package className="text-indigo-400" size={26} /> Productos
          </h1>
          <p className="text-slate-400 text-sm mt-1">{productos.length} productos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          {/* En la app Android el WebView no descarga archivos: el PDF se imprime desde la PC (web). */}
          {!Capacitor.isNativePlatform() && <button onClick={descargarEtiquetas} disabled={generandoEtiquetas}
            title="PDF para imprimir las etiquetas de los productos con código interno"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600/70 text-slate-200 text-sm font-medium hover:bg-slate-800/60 disabled:opacity-50 transition-colors">
            <Printer size={16} /> {generandoEtiquetas ? 'Generando…' : 'Etiquetas (PDF)'}
          </button>}
          <button onClick={openCreate} className="btn-premium flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium">
            <Plus size={16} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input ref={buscadorRef} type="text" placeholder="Buscar por nombre o código, o escaneá con el lector..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors" />
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-20">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-20">No hay productos. ¡Crea el primero!</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(prod => (
              <div key={prod.id} className="glass-panel glass-panel-hover rounded-xl overflow-hidden group">
                <div className="h-36 bg-slate-800/60 relative">
                  {prod.imgUrlProducto
                    ? <img src={`${getApiUrl()}${prod.imgUrlProducto}`} alt={prod.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Package size={36} className="text-slate-600" /></div>
                  }
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => openEdit(prod)} className="p-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(prod.id)} className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-slate-200 font-medium text-sm">{prod.nombre}</h3>
                  <div className="mt-2 space-y-1">
                    {(prod.presentaciones || []).map(p => (
                      <div key={p.id} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{p.tipo_presentacion?.nombreTipoPresentacion}</span>
                          <span className="text-emerald-400 font-semibold">${p.precio.toFixed(2)}</span>
                        </div>
                        {p.sku && <span className="text-slate-600 font-mono text-[10px]">{p.sku}</span>}
                      </div>
                    ))}
                  </div>
                  {(prod.categorias_asociadas || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prod.categorias_asociadas.slice(0, 3).map(c => (
                        <span key={c.codCategoria} className="px-1.5 py-0.5 rounded text-xs bg-slate-700/60 text-slate-400">
                          {c.categoria?.nombreCategoria || ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h2 className="text-lg font-bold text-slate-100">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Imagen */}
              <div onClick={() => fileInputRef.current.click()}
                className="h-28 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-colors flex items-center justify-center overflow-hidden bg-slate-800/40">
                {previewImg
                  ? <img src={previewImg} alt="preview" className="w-full h-full object-cover" />
                  : <div className="text-center"><Upload size={22} className="text-slate-500 mx-auto mb-1" /><p className="text-slate-500 text-xs">Clic para imagen</p></div>
                }
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              </div>

              {/* Presentaciones + Precios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">Presentaciones y Precios *</label>
                  <button type="button" onClick={addPresentacion}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors">
                    <Plus size={12} /> Agregar
                  </button>
                </div>
                {form.presentacionesPrecios.length === 0
                  ? <p className="text-slate-600 text-xs text-center py-4 border border-dashed border-slate-700 rounded-xl">Sin presentaciones. Hacé clic en "Agregar".</p>
                  : (
                    <div className="space-y-2">
                      {form.presentacionesPrecios.map((pp, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-slate-700/60 bg-slate-800/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <select value={pp.codTipoPresentacion}
                              onChange={e => updatePresentacion(idx, 'codTipoPresentacion', parseInt(e.target.value))}
                              className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60">
                              {presentaciones.map(p => (
                                <option key={p.codTipoPresentacion} value={p.codTipoPresentacion}>{p.nombreTipoPresentacion}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2">
                              <span className="text-slate-500 text-sm">$</span>
                              <input type="number" step="0.01" min="0" value={pp.precio} data-sku={pp.sku || ''}
                                onChange={e => updatePresentacion(idx, 'precio', e.target.value)}
                                className="w-24 py-1.5 bg-transparent text-slate-200 text-sm focus:outline-none" />
                            </div>
                            <button type="button" onClick={() => removePresentacion(idx)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                              <Trash size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <CampoCodigoBarras valor={pp.sku || ''} onCambiar={codigo => updatePresentacion(idx, 'sku', codigo)} />
                            <button type="button" onClick={() => handleScanSku(idx)} title="Escanear código de barras"
                              className="shrink-0 p-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors">
                              <ScanLine size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>

              {/* Categorías */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1"><Tag size={12} /> Categorías</label>
                <div className="flex flex-wrap gap-2">
                  {categorias.map(cat => (
                    <button type="button" key={cat.codCategoria} onClick={() => toggleCategoria(cat.codCategoria)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all ${form.categorias.includes(cat.codCategoria) ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
                      {cat.nombreCategoria}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800/50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-premium px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50">
                  {saving ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escaneo de código de barras (solo navegador; en la app Android es la cámara nativa) */}
      {scanningIdx !== null && (
        <BarcodeScannerModal
          onScan={handleWebScanResult}
          onClose={() => setScanningIdx(null)}
        />
      )}
    </div>
  );
}
