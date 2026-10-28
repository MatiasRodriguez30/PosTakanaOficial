import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Tag, Plus, Edit2, Trash2, X, Check } from 'lucide-react';

function CrudSection({ title, icon: Icon, items, loading, onCreate, onEdit, onDelete, renderItem, modalContent, showModal, setShowModal, error, saving }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Icon size={18} className="text-indigo-400" />
          {title}
        </h2>
        <button onClick={onCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs hover:bg-indigo-600/30 transition-colors">
          <Plus size={14} /> Agregar
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm text-center py-10">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-600 text-sm text-center py-10 border border-dashed border-slate-700 rounded-xl">Sin registros aún</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id || item.codCategoria || item.codTipoPresentacion || item.codMedioPago}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition-colors group">
              {renderItem(item)}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="glass-panel rounded-2xl w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {modalContent}
              {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 mt-3">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
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
    fetchCategorias(); fetchPresentaciones(); fetchMediosPago();
  }, []);

  // ===== CATEGORÍAS =====
  const fetchCategorias = async () => { setLoadingCats(true); try { setCategorias(await api.get('/api/categorias')); } finally { setLoadingCats(false); } };
  const openCreateCat = () => { setEditingCat(null); setCatNombre(''); setCatError(''); setShowCatModal(true); };
  const openEditCat = (cat) => { setEditingCat(cat); setCatNombre(cat.nombreCategoria); setCatError(''); setShowCatModal(true); };
  const deleteCat = async (cat) => {
    if (!window.confirm(`¿Dar de baja la categoría "${cat.nombreCategoria}"?`)) return;
    try { await api.delete(`/api/categorias/${cat.codCategoria}`); await fetchCategorias(); } catch (e) { alert(e.message); }
  };
  const saveCat = async (e) => {
    e.preventDefault(); setCatError('');
    if (!catNombre.trim()) { setCatError('El nombre es obligatorio.'); return; }
    setSavingCat(true);
    try {
      if (editingCat) await api.put(`/api/categorias/${editingCat.codCategoria}`, { nombreCategoria: catNombre.trim() });
      else await api.post('/api/categorias', { nombreCategoria: catNombre.trim() });
      setShowCatModal(false); await fetchCategorias();
    } catch (e) { setCatError(e.message); } finally { setSavingCat(false); }
  };

  // ===== PRESENTACIONES =====
  const fetchPresentaciones = async () => { setLoadingPres(true); try { setPresentaciones(await api.get('/api/presentaciones')); } finally { setLoadingPres(false); } };
  const openCreatePres = () => { setEditingPres(null); setPresNombre(''); setPresInterno(false); setPresError(''); setShowPresModal(true); };
  const openEditPres = (p) => { setEditingPres(p); setPresNombre(p.nombreTipoPresentacion); setPresInterno(!!p.requiereCodigoInterno); setPresError(''); setShowPresModal(true); };
  const deletePres = async (p) => {
    if (!window.confirm(`¿Dar de baja la presentación "${p.nombreTipoPresentacion}"?`)) return;
    try { await api.delete(`/api/presentaciones/${p.codTipoPresentacion}`); await fetchPresentaciones(); } catch (e) { alert(e.message); }
  };
  const savePres = async (e) => {
    e.preventDefault(); setPresError('');
    if (!presNombre.trim()) { setPresError('El nombre es obligatorio.'); return; }
    setSavingPres(true);
    try {
      if (editingPres) await api.put(`/api/presentaciones/${editingPres.codTipoPresentacion}`, { nombreTipoPresentacion: presNombre.trim(), requiereCodigoInterno: presInterno });
      else await api.post('/api/presentaciones', { nombreTipoPresentacion: presNombre.trim(), requiereCodigoInterno: presInterno });
      setShowPresModal(false); await fetchPresentaciones();
    } catch (e) { setPresError(e.message); } finally { setSavingPres(false); }
  };

  // ===== MEDIOS DE PAGO =====
  const fetchMediosPago = async () => { setLoadingMP(true); try { setMediosPago(await api.get('/api/medios-pago')); } finally { setLoadingMP(false); } };
  const openCreateMP = () => { setEditingMP(null); setMpNombre(''); setMpDefault(false); setMpError(''); setShowMPModal(true); };
  const openEditMP = (mp) => { setEditingMP(mp); setMpNombre(mp.nombreMedioPago); setMpDefault(mp.is_default); setMpError(''); setShowMPModal(true); };
  const deleteMP = async (mp) => {
    if (!window.confirm(`¿Dar de baja el medio de pago "${mp.nombreMedioPago}"?`)) return;
    try { await api.delete(`/api/medios-pago/${mp.codMedioPago}`); await fetchMediosPago(); } catch (e) { alert(e.message); }
  };
  const saveMP = async (e) => {
    e.preventDefault(); setMpError('');
    if (!mpNombre.trim()) { setMpError('El nombre es obligatorio.'); return; }
    setSavingMP(true);
    try {
      if (editingMP) await api.put(`/api/medios-pago/${editingMP.codMedioPago}`, { nombreMedioPago: mpNombre.trim(), is_default: mpDefault });
      else await api.post('/api/medios-pago', { nombreMedioPago: mpNombre.trim(), is_default: mpDefault });
      setShowMPModal(false); await fetchMediosPago();
    } catch (e) { setMpError(e.message); } finally { setSavingMP(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors";
  const saveBtn = (saving, label) => (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={() => { setShowCatModal(false); setShowPresModal(false); setShowMPModal(false); }}
        className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800/50 transition-colors">
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="flex-1 btn-premium px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50">
        {saving ? 'Guardando...' : label}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-slate-100">Catálogos</h1>
        <p className="text-slate-400 text-sm mt-1">Gestión de categorías, presentaciones y medios de pago</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Categorías */}
        <CrudSection
          title="Categorías" icon={Tag}
          items={categorias} loading={loadingCats}
          onCreate={openCreateCat} onEdit={openEditCat} onDelete={deleteCat}
          renderItem={cat => <span className="text-slate-200 text-sm">{cat.nombreCategoria}</span>}
          showModal={showCatModal} setShowModal={setShowCatModal}
          error={catError} saving={savingCat}
          modalContent={
            <form onSubmit={saveCat} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre de la Categoría</label>
                <input type="text" value={catNombre} onChange={e => setCatNombre(e.target.value)} autoFocus className={inputClass} />
              </div>
              {saveBtn(savingCat, editingCat ? 'Actualizar' : 'Crear')}
            </form>
          }
        />

        {/* Presentaciones */}
        <CrudSection
          title="Tipos de Presentación" icon={Tag}
          items={presentaciones} loading={loadingPres}
          onCreate={openCreatePres} onEdit={openEditPres} onDelete={deletePres}
          renderItem={p => (
            <div className="flex items-center gap-2">
              <span className="text-slate-200 text-sm">{p.nombreTipoPresentacion}</span>
              {p.requiereCodigoInterno && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700/60 border border-slate-600/60 text-slate-300">Código interno</span>
              )}
            </div>
          )}
          showModal={showPresModal} setShowModal={setShowPresModal}
          error={presError} saving={savingPres}
          modalContent={
            <form onSubmit={savePres} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre de la Presentación (ej: 1Kg, 2Kg...)</label>
                <input type="text" value={presNombre} onChange={e => setPresNombre(e.target.value)} autoFocus className={inputClass} />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={presInterno} onChange={e => setPresInterno(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-300">
                  Requiere código interno
                  <span className="block text-xs text-slate-500">Los productos con esta presentación que no tengan código de barras reciben uno interno, para imprimir su etiqueta desde Productos.</span>
                </span>
              </label>
              {saveBtn(savingPres, editingPres ? 'Actualizar' : 'Crear')}
            </form>
          }
        />

        {/* Medios de Pago */}
        <CrudSection
          title="Medios de Pago" icon={Tag}
          items={mediosPago} loading={loadingMP}
          onCreate={openCreateMP} onEdit={openEditMP} onDelete={deleteMP}
          renderItem={mp => (
            <div className="flex items-center gap-2">
              <span className="text-slate-200 text-sm">{mp.nombreMedioPago}</span>
              {mp.is_default && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <Check size={10} /> Predeterminado
                </span>
              )}
            </div>
          )}
          showModal={showMPModal} setShowModal={setShowMPModal}
          error={mpError} saving={savingMP}
          modalContent={
            <form onSubmit={saveMP} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre del Medio de Pago</label>
                <input type="text" value={mpNombre} onChange={e => setMpNombre(e.target.value)} autoFocus className={inputClass} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${mpDefault ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  onClick={() => setMpDefault(v => !v)}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${mpDefault ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-slate-300">Marcar como predeterminado</span>
              </label>
              {saveBtn(savingMP, editingMP ? 'Actualizar' : 'Crear')}
            </form>
          }
        />
      </div>
    </div>
  );
}
