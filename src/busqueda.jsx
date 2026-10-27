import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getApiUrl } from './api';

// Búsqueda de productos del back (/api/productos/buscar): por significado con
// la IA local del servidor ("comida gato bebé" encuentra "Sabrosito gatito"),
// o por texto si está apagada. Pide sesión iniciada.
// Devuelve null mientras no hay respuesta, si falla o para códigos de barras:
// en ese caso cada pantalla filtra como siempre, en el equipo.
export function useBusquedaInteligente(termino) {
  const [resultado, setResultado] = useState(null); // { termino, ids, modo }
  const q = termino.trim();

  useEffect(() => {
    if (q.length < 3 || /^\d+$/.test(q)) { setResultado(null); return; }
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const token = localStorage.getItem('TAKANA_TOKEN');
        const response = await fetch(`${getApiUrl()}/api/productos/buscar?limite=30&q=${encodeURIComponent(q)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: control.signal
        });
        if (!response.ok) { setResultado(null); return; }
        const productos = await response.json();
        setResultado({ termino: q, ids: productos.map(p => p.id), modo: response.headers.get('X-Busqueda') });
      } catch {
        // cancelada (se siguió escribiendo) o sin conexión: queda el filtro local
      }
    }, 300);
    return () => { clearTimeout(espera); control.abort(); };
  }, [q]);

  return resultado && resultado.termino === q ? resultado : null;
}

// Los productos de la lista en el orden en que los devolvió la búsqueda.
export function ordenarPorBusqueda(productos, resultado) {
  const porId = new Map(productos.map(p => [p.id, p]));
  return resultado.ids.map(id => porId.get(id)).filter(Boolean);
}

export function AvisoBusqueda({ resultado }) {
  if (!resultado) return null;
  return resultado.modo === 'significado' ? (
    <p className="flex items-center gap-1.5 text-xs text-indigo-300">
      <Sparkles size={13} /> Búsqueda inteligente (IA local)
    </p>
  ) : (
    <p className="text-xs text-slate-500">Búsqueda por texto (la IA local está apagada)</p>
  );
}
