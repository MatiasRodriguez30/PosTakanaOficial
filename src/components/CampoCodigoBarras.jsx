import React, { useState } from 'react';
import { X } from 'lucide-react';

// Código de barras de una presentación, pensado para el lector USB o Bluetooth
// (funcionan como un teclado: "escriben" el código y mandan Enter).
// En reposo es un botón que muestra el código; al tocarlo queda esperando el
// escaneo. También se puede escribir a mano y confirmar con Enter. Escape cancela.
export default function CampoCodigoBarras({ valor, onCambiar }) {
  const [esperando, setEsperando] = useState(false);
  const [texto, setTexto] = useState('');

  const empezar = () => { setTexto(''); setEsperando(true); };
  const terminar = (confirmar) => {
    const codigo = texto.trim();
    if (confirmar && codigo) onCambiar(codigo);
    setEsperando(false);
    setTexto('');
  };

  if (esperando) {
    return (
      <input
        type="text"
        autoFocus
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          // Enter (o Tab, según cómo esté configurado el lector) confirma; nunca envía el formulario.
          if (e.key === 'Enter' || (e.key === 'Tab' && texto.trim())) { e.preventDefault(); terminar(true); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminar(false); }
        }}
        onBlur={() => terminar(true)}
        placeholder="Escaneá con el lector… (o escribilo y Enter · Esc cancela)"
        aria-label="Esperando el escaneo del código de barras"
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/70 text-slate-100 text-xs font-mono placeholder:text-indigo-300/70 focus:outline-none animate-pulse focus:animate-none"
      />
    );
  }

  return (
    <div className="flex-1 min-w-0 flex items-center gap-1">
      <button
        type="button"
        onClick={empezar}
        title="Tocá y escaneá con el lector para cambiar el código"
        className="flex-1 min-w-0 text-left px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:border-indigo-500/60 text-xs font-mono truncate transition-colors"
      >
        {valor
          ? <span className="text-slate-200">{valor}</span>
          : <span className="text-slate-500 font-sans">Sin código · tocá y escaneá con el lector</span>}
      </button>
      {valor && (
        <button
          type="button"
          onClick={() => onCambiar('')}
          title="Quitar el código de barras"
          aria-label="Quitar el código de barras"
          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
