import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Asegúrate de que window.SUPABASE_CONFIG esté definido en tu config.js
const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

// --- CONFIGURACIÓN VISUAL ---
const brandPalette = {
  'M1': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' }, // Azul
  'K1': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' }, // Verde Esmeralda
  'B1': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' }, // Ambar
  'B2': { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' }, // Violeta
  'B3': { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' }, // Rosa
  'B4': { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },  // Cyan
  'M2': { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' }, // Indigo
  // Ya no necesitamos 'Otros' aquí porque lo filtramos en SQL
}

const defaultColors = ['#ef4444', '#f97316', '#84cc16', '#14b8a6']

function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color + '33' }
}

function formatDate(dateString) {
  // Nota: dateString viene de SQL, ej: "2023-11-20T00:00:00"
  const date = new Date(dateString) 
  // Ajustamos zona horaria para evitar que cambie de día al convertir
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
  
  return adjustedDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

async function loadData() {
  const loader = document.getElementById('loader')
  const content = document.getElementById('dashboard-content')
  const lastUpdateLabel = document.getElementById('last-update')

  try {
    console.log("🔄 Iniciando carga de datos...")

    // 1️⃣ DEFINIR FECHA DE CORTE
    const cutOffDate = new Date()
    cutOffDate.setDate(cutOffDate.getDate() - 15) // Últimos 15 días

    // 2️⃣ CONSULTA A SUPABASE (AQUÍ ESTÁ EL CAMBIO IMPORTANTE)
    // Cambiamos .from('messages') por .from('daily_brand_counts')
    // Esta "vista" es super rápida y ya tiene los conteos hechos.
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*') // Trae: day, brand, total_count
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })
      // NOTA: Ya no necesitamos .limit(10000) porque esto devuelve pocas filas

    if (error) throw error

    console.log(`✅ Datos recibidos: ${data.length} filas (Resumen agrupado)`)

    // --- PROCESAMIENTO DE DATOS ---
    const pivot = {}
    const brandsSet = new Set()
    
    // Aquí el procesamiento es más sencillo porque SQL ya contó los mensajes
    data.forEach(d => {
      // En la vista SQL la columna de fecha se llama 'day'
      const date = formatDate(d.day) 
      const brand = d.brand
      const count = d.total_count // Este número ya viene calculado de SQL

      brandsSet.add(brand)
      
      if (!pivot[date]) pivot[date] = {}
      
      // Simplemente asignamos el valor que vino de la base de datos
      pivot[date][brand] = count
    })

    const knownBrands = Object.keys(brandPalette)
    const foundBrands = Array.from(brandsSet)
    
    // Ordenar marcas
    const sortedBrands = foundBrands.sort((a, b) => {
        const aKnown = knownBrands.includes(a);
        const bKnown = knownBrands.includes(b);
        if (aKnown && !bKnown) return -1;
        if (!aKnown && bKnown) return 1;
        return a.localeCompare(b);
    });

    const sortedDates = Object.keys(pivot)

    // --- RENDERIZADO TABLA ---
    const theadRow = document.getElementById('table-header-row')
    const tbody = document.getElementById('table-body')
    
    theadRow.innerHTML = '<th class="px-6 py-3 rounded-tl-lg">Fecha</th>'
    sortedBrands.forEach(b => {
        theadRow.innerHTML += `<th class="px-6 py-3 text-center">${b}</th>`
    })
    theadRow.innerHTML += '<th class="px-6 py-3 text-right rounded-tr-lg">Total</th>'

    tbody.innerHTML = ''
    
    // Invertir orden para la tabla (hoy primero)
    ;[...sortedDates].reverse().forEach(date => {
        const tr = document.createElement('tr')
        tr.className = "hover:bg-slate-50 transition-colors"
        
        let rowHtml = `<td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">${date}</td>`
        let total = 0
        
        sortedBrands.forEach(brand => {
            const count = pivot[date][brand] || 0
            total += count
            const textClass = count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium'
            rowHtml += `<td class="px-6 py-4 text-center ${textClass}">${count > 0 ? count : '-'}</td>`
        })
        
        rowHtml += `<td class="px-6 py-4 text-right font-bold text-indigo-600">${total}</td>`
        tr.innerHTML = rowHtml
        tbody.appendChild(tr)
    })

    // --- RENDERIZADO GRÁFICO ---
    const chartCanvas = document.getElementById('chart');
    if (window.myChartInstance) {
        window.myChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d')
    
    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        return {
            label: brand,
            data: sortedDates.map(date => pivot[date][brand] || 0),
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6
        }
    })

    window.myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Inter', sans-serif", size: 12 } }
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
                    grid: { display: false },
                    ticks: { font: { family: "'Inter', sans-serif" } }
                },
                y: {
                    stacked: true,
                    grid: { color: '#f1f5f9' },
                    beginAtZero: true,
                    border: { display: false }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    })

    const now = new Date()
    lastUpdateLabel.textContent = `Actualizado: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`

    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    console.error("Error cargando dashboard:", err)
    loader.innerHTML = `<p class="text-red-500">Error al cargar los datos. Revisa la consola (F12) para más detalles.</p>`
  }
}

loadData()
