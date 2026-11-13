import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatearPesos, formatearCantidad } from '../formato';

const aNumero = (texto) => parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));

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
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(0.01, Math.round((cantidad - 0.5) * 100) / 100))}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          aria-label="Restar media unidad"
          title="Restar 0,5"
        >
          <Minus size={14} />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={texto ?? formatearCantidad(cantidad)}
          onFocus={() => setTexto(formatearCantidad(cantidad))}
          onChange={(e) => {
            // Coma o punto como decimal (el teclado numérico de Android en español manda coma).
            setTexto(e.target.value);
            const v = parseFloat(e.target.value.replace(',', '.'));
            if (!isNaN(v) && v > 0) onCambiar(v);
          }}
          onBlur={() => setTexto(null)}
          aria-label="Cantidad"
          className="w-16 h-8 text-center rounded-md bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-700 dark:focus:ring-brand-400"
        />
        <button
          type="button"
          onClick={() => onCambiar(Math.round((cantidad + 0.5) * 100) / 100)}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          aria-label="Sumar media unidad"
          title="Sumar 0,5"
        >
          <Plus size={14} />
        </button>

        {importe === null ? (
          <button
            type="button"
            onClick={() => setImporte('')}
            title="Cargar por importe: el cliente pide $500, $1300…"
            className="ml-auto h-8 whitespace-nowrap px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            $ Por importe
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-slate-600 dark:text-slate-400 text-xs font-semibold">$</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmarImporte();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setImporte(null);
                }
              }}
              onBlur={confirmarImporte}
              placeholder="500"
              aria-label="Importe en pesos"
              className="w-24 h-8 text-right px-2 rounded-md bg-white dark:bg-slate-900 border border-brand-700 dark:border-brand-400 text-slate-900 dark:text-slate-100 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-700"
            />
          </div>
        )}
      </div>
      {kilos && (cantidad * kilos < 1 || cantidad % 1 !== 0) && (
        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          Equivale a{' '}
          <strong className="font-semibold text-slate-800 dark:text-slate-200">
            {cantidad * kilos < 1
              ? `${Math.round(cantidad * kilos * 1000)} g`
              : `${formatearCantidad(cantidad * kilos)} kg`}
          </strong>
          {' · '}
          {formatearPesos(precio * cantidad)}
        </p>
      )}
    </div>
  );
}
