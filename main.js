import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

// --- CONFIGURACIÓN VISUAL ---
// Paleta de colores fija para consistencia visual
const brandPalette = {
  'M1': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' }, // Azul
  'K1': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' }, // Verde Esmeralda
  'B1': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' }, // Ambar
  'B2': { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' }, // Violeta
  'B3': { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' }, // Rosa
  'B4': { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },  // Cyan
  'M2': { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' }, // Indigo
  'Otros': { border: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)' } // Gris
}

const defaultColors = ['#ef4444', '#f97316', '#84cc16', '#14b8a6']

function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  // Si no existe, asignar uno rotativo
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color + '33' } // Agrega transparencia
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

async function loadData() {
  const loader = document.getElementById('loader')
  const content = document.getElementById('dashboard-content')
  const lastUpdateLabel = document.getElementById('last-update')

  try {
    // 1️⃣ DEFINIR FECHA DE CORTE (Optimización)
    // Traemos solo los últimos 15 días para que la carga sea rápida y relevante
    const cutOffDate = new Date()
    cutOffDate.setDate(cutOffDate.getDate() - 15)

    // 2️⃣ CONSULTA A SUPABASE (CORRECCIÓN APLICADA)
    let { data, error } = await supabase
      .from('messages')
      .select('date, brand')
      .gte('date', cutOffDate.toISOString()) // Filtro: Solo desde hace 15 días
      .order('date', { ascending: true })
      .limit(10000) // <--- ¡AQUÍ ESTÁ LA SOLUCIÓN! Subimos el límite de 1000 a 10000

    if (error) throw error

    // --- PROCESAMIENTO DE DATOS ---
    const pivot = {}
    const brandsSet = new Set()
    
    // Filtrar fechas inválidas y pivotear
    data.forEach(d => {
      if (!d.brand) d.brand = "Otros" // Normalizar nulos
      brandsSet.add(d.brand)
      
      const date = formatDate(d.date)
      if (!pivot[date]) pivot[date] = {}
      
      pivot[date][d.brand] = (pivot[date][d.brand] || 0) + 1
    })

    // Ordenar marcas: Primero las conocidas, luego el resto, "Otros" al final
    const knownBrands = Object.keys(brandPalette).filter(b => b !== 'Otros')
    const foundBrands = Array.from(brandsSet)
    
    const sortedBrands = foundBrands.sort((a, b) => {
        if (a === 'Otros') return 1;
        if (b === 'Otros') return -1;
        const aKnown = knownBrands.includes(a);
        const bKnown = knownBrands.includes(b);
        if (aKnown && !bKnown) return -1;
        if (!aKnown && bKnown) return 1;
        return a.localeCompare(b);
    });

    const sortedDates = Object.keys(pivot) // Vienen ordenados por la query SQL

    // --- RENDERIZADO TABLA ---
    const theadRow = document.getElementById('table-header-row')
    const tbody = document.getElementById('table-body')
    
    // Header
    theadRow.innerHTML = '<th class="px-6 py-3 rounded-tl-lg">Fecha</th>'
    sortedBrands.forEach(b => {
        theadRow.innerHTML += `<th class="px-6 py-3 text-center">${b}</th>`
    })
    theadRow.innerHTML += '<th class="px-6 py-3 text-right rounded-tr-lg">Total</th>'

    // Body
    tbody.innerHTML = ''
    
    // Invertimos el orden SOLO para la tabla (para ver hoy primero)
    // Usamos [...sortedDates] para crear una copia y no afectar el orden del gráfico
    ;[...sortedDates].reverse().forEach(date => {
        const tr = document.createElement('tr')
        tr.className = "hover:bg-slate-50 transition-colors"
        
        let rowHtml = `<td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">${date}</td>`
        let total = 0
        
        sortedBrands.forEach(brand => {
            const count = pivot[date][brand] || 0
            total += count
            // Resaltar ceros en gris claro
            const textClass = count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium'
            rowHtml += `<td class="px-6 py-4 text-center ${textClass}">${count > 0 ? count : '-'}</td>`
        })
        
        rowHtml += `<td class="px-6 py-4 text-right font-bold text-indigo-600">${total}</td>`
        tr.innerHTML = rowHtml
        tbody.appendChild(tr)
    })

    // --- RENDERIZADO GRÁFICO ---
    const ctx = document.getElementById('chart').getContext('2d')
    
    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        return {
            label: brand,
            data: sortedDates.map(date => pivot[date][brand] || 0),
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            tension: 0.4, // Curvas suaves
            fill: true,   // Área rellena
            pointRadius: 3,
            pointHoverRadius: 6
        }
    })

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates, // Gráfico mantiene orden cronológico (Izq -> Der)
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: "'Inter', sans-serif", size: 13 },
                    bodyFont: { family: "'Inter', sans-serif", size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { display: false }, // Ocultar grilla vertical
                    ticks: { font: { family: "'Inter', sans-serif" } }
                },
                y: {
                    stacked: true, // Gráfico apilado
                    grid: { color: '#f1f5f9' },
                    beginAtZero: true,
                    border: { display: false } // Ocultar línea del eje Y
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    })

    // Actualizar timestamp
    const now = new Date()
    lastUpdateLabel.textContent = `Actualizado: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`

    // Mostrar dashboard
    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    console.error("Error cargando dashboard:", err)
    loader.innerHTML = `<p class="text-red-500">Error al cargar los datos. Revisa la consola.</p>`
  }
}

loadData()
