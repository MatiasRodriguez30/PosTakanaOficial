import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const aNumero = (texto) => parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));
const mostrarCantidad = (v) => String(Number(v.toFixed(3))).replace('.', ',');

// Kilos de la presentación si su nombre los dice ("1Kg", "20 kg", "1,5kg"), si no null.
const kilosDe = (presentacion) => {
  const m = /(\d+(?:[.,]\d+)?)\s*kg/i.exec(presentacion || '');
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

// Cantidad de un renglón del ticket: −/+ de a 0,5, escribirla (con coma o
// punto), o cargarla por importe ("dame $500"): la cantidad queda en
// importe / precio, sin redondear, así el renglón da justo ese importe.
export default function CantidadTicket({ cantidad, precio, presentacion, onCambiar }) {
  const [texto, setTexto] = useState(null);       // null = no se está escribiendo la cantidad
  const [importe, setImporte] = useState(null);   // null = sin el campo de importe abierto
  const kilos = kilosDe(presentacion);

  const confirmarImporte = () => {
    const monto = aNumero(importe);
    if (monto > 0 && precio > 0) onCambiar(monto / precio);
    setImporte(null);
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onCambiar(Math.max(0.01, Math.round((cantidad - 0.5) * 100) / 100))}
          className="p-1.5 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors" aria-label="Restar media unidad">
          <Minus size={12} />
        </button>
        <input
          type="text" inputMode="decimal"
          value={texto ?? mostrarCantidad(cantidad)}
          onFocus={() => setTexto(mostrarCantidad(cantidad))}
          onChange={e => {
            // Coma o punto como decimal (el teclado numérico de Android en español manda coma).
            setTexto(e.target.value);
            const v = parseFloat(e.target.value.replace(',', '.'));
            if (!isNaN(v) && v > 0) onCambiar(v);
          }}
          onBlur={() => setTexto(null)}
          aria-label="Cantidad"
          className="w-16 text-center py-1 rounded-md bg-slate-900/60 border border-slate-700/60 text-slate-200 text-sm tabular-nums focus:outline-none focus:border-indigo-500/60"
        />
        <button type="button" onClick={() => onCambiar(Math.round((cantidad + 0.5) * 100) / 100)}
          className="p-1.5 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors" aria-label="Sumar media unidad">
          <Plus size={12} />
        </button>

        {importe === null ? (
          <button type="button" onClick={() => setImporte('')} title="Cargar por importe: el cliente pide $500, $1300…"
            className="whitespace-nowrap px-2 py-1 rounded-md border border-slate-600/70 text-slate-300 text-xs font-medium hover:bg-slate-700/60 transition-colors">
            $ Importe
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-sm">$</span>
            <input
              type="text" inputMode="decimal" autoFocus
              value={importe}
              onChange={e => setImporte(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmarImporte(); }
                else if (e.key === 'Escape') { e.preventDefault(); setImporte(null); }
              }}
              onBlur={confirmarImporte}
              placeholder="500"
              aria-label="Importe en pesos"
              className="w-20 text-right px-2 py-1 rounded-md bg-slate-900/60 border border-indigo-500/70 text-slate-100 text-sm tabular-nums focus:outline-none"
            />
          </div>
        )}
      </div>
      {kilos && (cantidad * kilos < 1 || cantidad % 1 !== 0) && (
        <p className="mt-1 text-xs text-slate-400 tabular-nums">
          ≈ {cantidad * kilos < 1
            ? `${Math.round(cantidad * kilos * 1000)} g`
            : `${String(Number((cantidad * kilos).toFixed(3))).replace('.', ',')} kg`}
          {' · '}{formatoMoneda.format(precio * cantidad)}
        </p>
      )}
    </div>
  );
}
