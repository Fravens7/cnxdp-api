import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

// --- CONFIGURACIÓN VISUAL ---
const brandPalette = {
  'M1': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.6)' }, 
  'K1': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.6)' }, 
  'B1': { border: '#f97316', bg: 'rgba(249, 115, 22, 0.6)' }, 
  'B2': { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.6)' }, 
  'B3': { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.6)' }, 
  'B4': { border: '#84cc16', bg: 'rgba(132, 204, 22, 0.6)' }, 
  'M2': { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.6)' }, 
}
const defaultColors = ['#64748b', '#94a3b8', '#cbd5e1']

// VARIABLES GLOBALES PARA ESTADO
let globalData = []; // Aquí guardaremos los datos de Supabase
let selectedStart = null;
let selectedEnd = null;

// --- FUNCIONES UTILITARIAS ---
function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color + '99' }
}

function formatDateKey(dateObj) {
  // Formato YYYY-MM-DD para comparaciones internas
  return dateObj.toISOString().split('T')[0];
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString)
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
  return adjustedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- LÓGICA DEL SELECTOR DE FECHAS (Aquí está la magia) ---
function renderDateSelector() {
    const container = document.getElementById('date-selector-container');
    container.innerHTML = '';

    // 1. CONFIGURACIÓN DE FECHAS
    // Generamos desde el 17 (visual) hasta el 27
    const startDate = new Date('2025-11-17'); 
    const endDate = new Date('2025-11-27');
    const validDataStart = new Date('2025-11-20'); // Antes de esto, disable

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate); // "2025-11-17"
        const displayDay = currentDate.getDate();
        const displayMonth = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Verificar si es un día "sin datos" (disable)
        const isDisabled = currentDate < validDataStart;
        
        // Verificar si está seleccionado
        let isSelected = false;
        if (selectedStart && selectedEnd) {
             isSelected = dateKey >= selectedStart && dateKey <= selectedEnd;
        } else if (selectedStart) {
             isSelected = dateKey === selectedStart;
        }

        // CREAR EL BOTÓN
        const btn = document.createElement('button');
        
        // Estilos base
        let classes = "flex flex-col items-center justify-center px-4 py-2 rounded-lg border transition-all text-sm min-w-[70px] ";
        
        if (isDisabled) {
            // ESTILO DESHABILITADO (Gris claro, no click)
            classes += "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60";
            btn.disabled = true;
        } else if (isSelected) {
            // ESTILO SELECCIONADO (Azul fuerte)
            classes += "bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105 font-bold";
        } else {
            // ESTILO DISPONIBLE (Blanco hover azulito)
            classes += "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50";
        }
        
        btn.className = classes;
        btn.innerHTML = `
            <span class="text-[10px] uppercase tracking-wide opacity-80">${dayName}</span>
            <span class="text-lg font-bold leading-none">${displayDay}</span>
        `;

        // EVENTO CLICK
        if (!isDisabled) {
            btn.onclick = () => handleDateClick(dateKey);
        }

        container.appendChild(btn);
        
        // Avanzar un día
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

function handleDateClick(dateKey) {
    if (!selectedStart || (selectedStart && selectedEnd)) {
        // Nuevo inicio (si no había nada o ya había un rango completo)
        selectedStart = dateKey;
        selectedEnd = null;
    } else {
        // Completar rango
        if (dateKey < selectedStart) {
            selectedEnd = selectedStart;
            selectedStart = dateKey;
        } else {
            selectedEnd = dateKey;
        }
    }
    
    // Si solo hay inicio, el fin es el mismo día (selección de 1 día)
    const effectiveEnd = selectedEnd || selectedStart;
    
    renderDateSelector(); // Re-pintar botones
    updateDashboard(selectedStart, effectiveEnd); // Filtrar datos
}

// --- FILTRADO Y ACTUALIZACIÓN ---
function updateDashboard(startKey, endKey) {
    console.log(`🔎 Filtrando de ${startKey} a ${endKey}`);

    // 1. Filtrar los datos globales en memoria
    const filteredData = globalData.filter(d => {
        // d.day viene como "2025-11-20T00:00..."
        const itemDate = d.day.split('T')[0];
        return itemDate >= startKey && itemDate <= endKey;
    });

    // 2. Procesar para Gráfica y Tabla (Igual que antes)
    const pivot = {}
    const brandsSet = new Set()
    const brandTotals = {}
    
    filteredData.forEach(d => {
        const date = formatDisplayDate(d.day)
        const brand = d.brand
        const count = d.total_count

        brandsSet.add(brand)
        brandTotals[brand] = (brandTotals[brand] || 0) + count;
        if (!pivot[date]) pivot[date] = {}
        pivot[date][brand] = count
    })

    const sortedBrands = Array.from(brandsSet).sort((a, b) => brandTotals[b] - brandTotals[a]);
    const sortedDates = Object.keys(pivot) // Fechas que quedaron tras el filtro

    // 3. Renderizar Tabla
    renderTable(sortedBrands, sortedDates, pivot);

    // 4. Renderizar Gráfico
    renderChart(sortedBrands, sortedDates, pivot);
}

// --- RENDERIZADORES SEPARADOS ---
function renderTable(sortedBrands, sortedDates, pivot) {
    const theadRow = document.getElementById('table-header-row')
    const tbody = document.getElementById('table-body')
    
    theadRow.innerHTML = '<th class="px-4 py-3 text-left font-semibold text-slate-600">DATE</th>'
    sortedBrands.forEach(b => {
        const colorStyle = brandPalette[b] ? `style="color: ${brandPalette[b].border}"` : '';
        theadRow.innerHTML += `<th class="px-4 py-3 text-center font-semibold" ${colorStyle}>${b}</th>`
    })
    theadRow.innerHTML += '<th class="px-4 py-3 text-right font-bold text-slate-700">TOTAL</th>'

    tbody.innerHTML = ''
    
    if (sortedDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-8 text-center text-slate-400">No data selected</td></tr>';
        return;
    }

    [...sortedDates].reverse().forEach(date => {
        const tr = document.createElement('tr')
        tr.className = "border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
        let rowHtml = `<td class="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">${date}</td>`
        let total = 0
        sortedBrands.forEach(brand => {
            const count = pivot[date][brand] || 0
            total += count
            const textClass = count === 0 ? 'text-slate-300' : 'text-slate-600 font-medium'
            rowHtml += `<td class="px-4 py-4 text-center ${textClass}">${count > 0 ? count.toLocaleString() : '-'}</td>`
        })
        rowHtml += `<td class="px-4 py-4 text-right font-black text-slate-800">${total.toLocaleString()}</td>`
        tr.innerHTML = rowHtml
        tbody.appendChild(tr)
    })
}

function renderChart(sortedBrands, sortedDates, pivot) {
    const chartCanvas = document.getElementById('chart');
    if (window.myChartInstance) window.myChartInstance.destroy();

    const ctx = chartCanvas.getContext('2d')
    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        return {
            label: brand,
            data: sortedDates.map(date => pivot[date][brand] || 0),
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: sortedDates.length === 1 ? 6 : 0, // Si es 1 día, mostramos puntos
            pointHoverRadius: 8
        }
    })

    window.myChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedDates, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 10 } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#334155',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    itemSort: (a, b) => b.raw - a.raw,
                    callbacks: {
                         label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                const value = context.parsed.y;
                                const total = context.chart.data.datasets.reduce((sum, dataset) => {
                                    return dataset.hidden ? sum : sum + (dataset.data[context.dataIndex] || 0);
                                }, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                label += value.toLocaleString() + ` (${percentage})`;
                            }
                            return label;
                        },
                        footer: (tooltipItems) => {
                            let total = 0;
                            tooltipItems.forEach(t => total += t.parsed.y);
                            return 'Daily Total: ' + total.toLocaleString();
                        }
                    },
                    footerFont: { weight: 'bold' },
                    footerColor: '#0f172a'
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0 } },
                y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { borderDash: [5, 5] } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    })
}

// --- CARGA INICIAL ---
async function loadData() {
  const loader = document.getElementById('loader')
  const content = document.getElementById('dashboard-content')
  const lastUpdateLabel = document.getElementById('last-update')

  try {
    console.log("🔄 Starting data load...")

    // 1️⃣ Pedimos TODO (Nov 20 en adelante)
    const cutOffDate = new Date('2025-11-20') // Tu fecha mínima real
    
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*')
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })

    if (error) throw error

    // 2️⃣ Guardamos en variable global y filtramos SYSTEM
    globalData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');
    console.log(`✅ Data loaded: ${globalData.length} rows`)

    // 3️⃣ INICIALIZAR VISTA
    // Por defecto mostramos todo el rango disponible
    selectedStart = '2025-11-20';
    selectedEnd = '2025-11-27';

    renderDateSelector(); // Dibuja los botones (incluyendo los disabled 17-19)
    updateDashboard(selectedStart, selectedEnd); // Dibuja Gráfico y Tabla

    const now = new Date()
    lastUpdateLabel.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}`
    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    console.error("Error loading dashboard:", err)
    loader.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`
  }
}

loadData()
