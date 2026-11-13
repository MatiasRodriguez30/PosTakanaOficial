import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Tag, Plus, Edit2, Trash2, X, Check, Layers, CreditCard } from 'lucide-react';

function CrudSection({
  title,
  icon: Icon,
  items,
  loading,
  onCreate,
  onEdit,
  onDelete,
  renderItem,
  modalContent,
  showModal,
  setShowModal,
  error,
}) {
  return (
    <section className="surface-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Icon size={17} className="text-brand-700 dark:text-brand-400" />
          {title}
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            ({items.length})
          </span>
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-300 text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      <div className="p-3 flex-1">
        {loading ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-10">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-10 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
            Sin registros cargados
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {items.map((item) => (
              <div
                key={item.id || item.codCategoria || item.codTipoPresentacion || item.codMedioPago}
                className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="min-w-0 flex-1">{renderItem(item)}</div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    aria-label="Editar"
                    title="Editar"
                    className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    aria-label="Dar de baja"
                    title="Dar de baja"
                    className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="surface-card w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {modalContent}
              {error && (
                <p className="text-red-800 dark:text-red-200 text-xs font-medium bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2 mt-3">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Catalogos() {
  // --- Categorías ---
  const [categorias, setCategorias] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catNombre, setCatNombre] = useState('');
  const [catError, setCatError] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // --- Presentaciones ---
  const [presentaciones, setPresentaciones] = useState([]);
  const [loadingPres, setLoadingPres] = useState(true);
  const [showPresModal, setShowPresModal] = useState(false);
  const [editingPres, setEditingPres] = useState(null);
  const [presNombre, setPresNombre] = useState('');
  const [presInterno, setPresInterno] = useState(false);
  const [presError, setPresError] = useState('');
  const [savingPres, setSavingPres] = useState(false);

  // --- Medios de Pago ---
  const [mediosPago, setMediosPago] = useState([]);
  const [loadingMP, setLoadingMP] = useState(true);
  const [showMPModal, setShowMPModal] = useState(false);
  const [editingMP, setEditingMP] = useState(null);
  const [mpNombre, setMpNombre] = useState('');
  const [mpDefault, setMpDefault] = useState(false);
  const [mpError, setMpError] = useState('');
  const [savingMP, setSavingMP] = useState(false);

  useEffect(() => {
    fetchCategorias();
    fetchPresentaciones();
    fetchMediosPago();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCatModal(false);
        setShowPresModal(false);
        setShowMPModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ===== CATEGORÍAS =====
  const fetchCategorias = async () => {
    setLoadingCats(true);
    try {
      setCategorias(await api.get('/api/categorias'));
    } finally {
      setLoadingCats(false);
    }
  };
  const openCreateCat = () => {
    setEditingCat(null);
    setCatNombre('');
    setCatError('');
    setShowCatModal(true);
  };
  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatNombre(cat.nombreCategoria);
    setCatError('');
    setShowCatModal(true);
  };
  const deleteCat = async (cat) => {
    if (!window.confirm(`¿Dar de baja la categoría "${cat.nombreCategoria}"?`)) return;
    try {
      await api.delete(`/api/categorias/${cat.codCategoria}`);
      await fetchCategorias();
    } catch (e) {
      alert(e.message);
    }
  };
  const saveCat = async (e) => {
    e.preventDefault();
    setCatError('');
    if (!catNombre.trim()) {
      setCatError('El nombre es obligatorio.');
      return;
    }
    setSavingCat(true);
    try {
      if (editingCat) {
        await api.put(`/api/categorias/${editingCat.codCategoria}`, { nombreCategoria: catNombre.trim() });
      } else {
        await api.post('/api/categorias', { nombreCategoria: catNombre.trim() });
      }
      setShowCatModal(false);
      await fetchCategorias();
    } catch (e) {
      setCatError(e.message);
    } finally {
      setSavingCat(false);
    }
  };

  // ===== PRESENTACIONES =====
  const fetchPresentaciones = async () => {
    setLoadingPres(true);
    try {
      setPresentaciones(await api.get('/api/presentaciones'));
    } finally {
      setLoadingPres(false);
    }
  };
  const openCreatePres = () => {
    setEditingPres(null);
    setPresNombre('');
    setPresInterno(false);
    setPresError('');
    setShowPresModal(true);
  };
  const openEditPres = (p) => {
    setEditingPres(p);
    setPresNombre(p.nombreTipoPresentacion);
    setPresInterno(!!p.requiereCodigoInterno);
    setPresError('');
    setShowPresModal(true);
  };
  const deletePres = async (p) => {
    if (!window.confirm(`¿Dar de baja la presentación "${p.nombreTipoPresentacion}"?`)) return;
    try {
      await api.delete(`/api/presentaciones/${p.codTipoPresentacion}`);
      await fetchPresentaciones();
    } catch (e) {
      alert(e.message);
    }
  };
  const savePres = async (e) => {
    e.preventDefault();
    setPresError('');
    if (!presNombre.trim()) {
      setPresError('El nombre es obligatorio.');
      return;
    }
    setSavingPres(true);
    try {
      if (editingPres) {
        await api.put(`/api/presentaciones/${editingPres.codTipoPresentacion}`, {
          nombreTipoPresentacion: presNombre.trim(),
          requiereCodigoInterno: presInterno,
        });
      } else {
        await api.post('/api/presentaciones', {
          nombreTipoPresentacion: presNombre.trim(),
          requiereCodigoInterno: presInterno,
        });
      }
      setShowPresModal(false);
      await fetchPresentaciones();
    } catch (e) {
      setPresError(e.message);
    } finally {
      setSavingPres(false);
    }
  };

  // ===== MEDIOS DE PAGO =====
  const fetchMediosPago = async () => {
    setLoadingMP(true);
    try {
      setMediosPago(await api.get('/api/medios-pago'));
    } finally {
      setLoadingMP(false);
    }
  };
  const openCreateMP = () => {
    setEditingMP(null);
    setMpNombre('');
    setMpDefault(false);
    setMpError('');
    setShowMPModal(true);
  };
  const openEditMP = (mp) => {
    setEditingMP(mp);
    setMpNombre(mp.nombreMedioPago);
    setMpDefault(mp.is_default);
    setMpError('');
    setShowMPModal(true);
  };
  const deleteMP = async (mp) => {
    if (!window.confirm(`¿Dar de baja el medio de pago "${mp.nombreMedioPago}"?`)) return;
    try {
      await api.delete(`/api/medios-pago/${mp.codMedioPago}`);
      await fetchMediosPago();
    } catch (e) {
      alert(e.message);
    }
  };
  const saveMP = async (e) => {
    e.preventDefault();
    setMpError('');
    if (!mpNombre.trim()) {
      setMpError('El nombre es obligatorio.');
      return;
    }
    setSavingMP(true);
    try {
      if (editingMP) {
        await api.put(`/api/medios-pago/${editingMP.codMedioPago}`, {
          nombreMedioPago: mpNombre.trim(),
          is_default: mpDefault,
        });
      } else {
        await api.post('/api/medios-pago', {
          nombreMedioPago: mpNombre.trim(),
          is_default: mpDefault,
        });
      }
      setShowMPModal(false);
      await fetchMediosPago();
    } catch (e) {
      setMpError(e.message);
    } finally {
      setSavingMP(false);
    }
  };

  const saveBtn = (saving, label) => (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={() => {
          setShowCatModal(false);
          setShowPresModal(false);
          setShowMPModal(false);
        }}
        className="flex-1 min-h-[42px] btn-secondary text-sm"
      >
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="flex-1 min-h-[42px] btn-brand text-sm">
        {saving ? 'Guardando...' : label}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Tag className="text-brand-700 dark:text-brand-400" size={22} />
          Catálogos
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-0.5">
          Gestión de categorías, tipos de presentación y medios de pago
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
          {/* Categorías */}
          <CrudSection
            title="Categorías"
            icon={Tag}
            items={categorias}
            loading={loadingCats}
            onCreate={openCreateCat}
            onEdit={openEditCat}
            onDelete={deleteCat}
            renderItem={(cat) => (
              <span className="text-slate-900 dark:text-slate-100 text-sm font-medium truncate block">
                {cat.nombreCategoria}
              </span>
            )}
            showModal={showCatModal}
            setShowModal={setShowCatModal}
            error={catError}
            modalContent={
              <form onSubmit={saveCat} className="space-y-4">
                <div>
                  <label htmlFor="cat-nombre" className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Nombre de la categoría
                  </label>
                  <input
                    id="cat-nombre"
                    type="text"
                    value={catNombre}
                    onChange={(e) => setCatNombre(e.target.value)}
                    autoFocus
                    className="input-base"
                  />
                </div>
                {saveBtn(savingCat, editingCat ? 'Actualizar' : 'Crear')}
              </form>
            }
          />

          {/* Presentaciones */}
          <CrudSection
            title="Tipos de Presentación"
            icon={Layers}
            items={presentaciones}
            loading={loadingPres}
            onCreate={openCreatePres}
            onEdit={openEditPres}
            onDelete={deletePres}
            renderItem={(p) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-medium">
                  {p.nombreTipoPresentacion}
                </span>
                {p.requiereCodigoInterno && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                    Código interno
                  </span>
                )}
              </div>
            )}
            showModal={showPresModal}
            setShowModal={setShowPresModal}
            error={presError}
            modalContent={
              <form onSubmit={savePres} className="space-y-4">
                <div>
                  <label htmlFor="pres-nombre" className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Nombre de la presentación (ej: 1 kg, 20 kg, Unidad)
                  </label>
                  <input
                    id="pres-nombre"
                    type="text"
                    value={presNombre}
                    onChange={(e) => setPresNombre(e.target.value)}
                    autoFocus
                    className="input-base"
                  />
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={presInterno}
                    onChange={(e) => setPresInterno(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand-700"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong className="block text-slate-900 dark:text-slate-100">Requiere código interno</strong>
                    Los productos con esta presentación sin código de barras reciben uno interno para imprimir su etiqueta desde Productos.
                  </span>
                </label>
                {saveBtn(savingPres, editingPres ? 'Actualizar' : 'Crear')}
              </form>
            }
          />

          {/* Medios de Pago */}
          <CrudSection
            title="Medios de Pago"
            icon={CreditCard}
            items={mediosPago}
            loading={loadingMP}
            onCreate={openCreateMP}
            onEdit={openEditMP}
            onDelete={deleteMP}
            renderItem={(mp) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-medium">
                  {mp.nombreMedioPago}
                </span>
                {mp.is_default && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 dark:bg-green-950/60 border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300">
                    <Check size={11} /> Predeterminado
                  </span>
                )}
              </div>
            )}
            showModal={showMPModal}
            setShowModal={setShowMPModal}
            error={mpError}
            modalContent={
              <form onSubmit={saveMP} className="space-y-4">
                <div>
                  <label htmlFor="mp-nombre" className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Nombre del medio de pago
                  </label>
                  <input
                    id="mp-nombre"
                    type="text"
                    value={mpNombre}
                    onChange={(e) => setMpNombre(e.target.value)}
                    autoFocus
                    className="input-base"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={mpDefault}
                    onChange={(e) => setMpDefault(e.target.checked)}
                    className="w-4 h-4 accent-brand-700"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Marcar como medio de pago predeterminado
                  </span>
                </label>
                {saveBtn(savingMP, editingMP ? 'Actualizar' : 'Crear')}
              </form>
            }
          />
        </div>
      </div>
    </div>
  );
}
