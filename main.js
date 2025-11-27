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
let globalData = [];
let selectedStart = null;
let selectedEnd = null;
// Guardamos la referencia al gráfico para destruirlo y recrearlo si cambiamos de tipo
let chartInstance = null; 

// --- FUNCIONES UTILITARIAS ---
function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color + '99' }
}

function formatDateKey(dateObj) {
  return dateObj.toISOString().split('T')[0];
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString)
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
  return adjustedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- LÓGICA DEL SELECTOR DE FECHAS (Corregida) ---
function renderDateSelector() {
    const container = document.getElementById('date-selector-container');
    container.innerHTML = '';

    const startDate = new Date('2025-11-17'); 
    const endDate = new Date('2025-11-27');
    const validDataStart = new Date('2025-11-20');

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate);
        const displayDay = currentDate.getDate();
        const displayMonth = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        const isDisabled = currentDate < validDataStart;
        
        let isSelected = false;
        if (selectedStart && selectedEnd) {
             // Si hay rango completo, se selecciona todo lo que esté dentro
             isSelected = dateKey >= selectedStart && dateKey <= selectedEnd;
        } else if (selectedStart) {
             // Si solo hay inicio, se selecciona solo ese día
             isSelected = dateKey === selectedStart;
        }

        const btn = document.createElement('button');
        
        let classes = "flex flex-col items-center justify-center px-4 py-2 rounded-lg border transition-all text-sm min-w-[70px] ";
        
        if (isDisabled) {
            classes += "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60";
            btn.disabled = true;
        } else if (isSelected) {
            classes += "bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105 font-bold";
        } else {
            classes += "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50";
        }
        
        btn.className = classes;
        btn.innerHTML = `
            <span class="text-[10px] uppercase tracking-wide opacity-80">${dayName}</span>
            <span class="text-lg font-bold leading-none">${displayDay}</span>
        `;

        if (!isDisabled) {
            btn.onclick = () => handleDateClick(dateKey);
        }

        container.appendChild(btn);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// Lógica de selección de rango estándar
function handleDateClick(dateKey) {
    if (!selectedStart || (selectedStart && selectedEnd)) {
        // Caso 1: No hay selección previa O ya hay un rango completo seleccionado.
        // Acción: Reiniciar la selección. La fecha clicada es el nuevo inicio.
        selectedStart = dateKey;
        selectedEnd = null;
    } else if (dateKey < selectedStart) {
         // Caso 2: Hay un inicio, y se hace clic en una fecha ANTERIOR.
         // Acción: La fecha anterior se convierte en el nuevo inicio, la fecha que era inicio pasa a ser fin.
         // (Esto permite seleccionar rangos "hacia atrás")
        selectedEnd = selectedStart;
        selectedStart = dateKey;
    } else {
        // Caso 3: Hay un inicio, y se hace clic en una fecha POSTERIOR.
        // Acción: La fecha clicada se convierte en el fin del rango.
        selectedEnd = dateKey;
    }
    
    // Si solo hay inicio (no se ha hecho el segundo clic), el fin es el mismo día.
    const effectiveEnd = selectedEnd || selectedStart;
    
    renderDateSelector();
    updateDashboard(selectedStart, effectiveEnd);
}

// --- FILTRADO Y ACTUALIZACIÓN ---
function updateDashboard(startKey, endKey) {
    // 1. Eliminados logs de consola

    const filteredData = globalData.filter(d => {
        const itemDate = d.day.split('T')[0];
        return itemDate >= startKey && itemDate <= endKey;
    });

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
    const sortedDates = Object.keys(pivot)

    renderTable(sortedBrands, sortedDates, pivot);
    renderChart(sortedBrands, sortedDates, pivot);
}

// --- RENDERIZADORES ---
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
    
    // IMPORTANTE: Si existe una instancia previa, la destruimos antes de crear la nueva.
    // Esto es necesario porque podríamos cambiar el tipo de gráfico.
    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d')
    
    // 2. Determinamos el tipo de gráfico: 'bar' para un día, 'line' para varios.
    const chartType = sortedDates.length === 1 ? 'bar' : 'line';

    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        return {
            label: brand,
            data: sortedDates.map(date => pivot[date][brand] || 0),
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            // Opciones específicas según el tipo de gráfico
            tension: chartType === 'line' ? 0.35 : 0,
            fill: true,
            pointRadius: chartType === 'line' ? 0 : 0, // Ocultamos puntos en ambos casos para limpieza
            pointHoverRadius: 6,
            // Ajuste para que las barras no sean demasiado anchas si es un solo día
            barPercentage: chartType === 'bar' ? 0.3 : 0.9, 
            categoryPercentage: chartType === 'bar' ? 0.5 : 0.8
        }
    })

    chartInstance = new Chart(ctx, {
        type: chartType,
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
                            // 3. Se eliminó el cálculo de porcentajes. Solo muestra valor absoluto.
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
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
                x: { 
                    grid: { display: false }, 
                    ticks: { maxRotation: 0 },
                    stacked: true // Asegura que las barras se apilen
                },
                y: { 
                    stacked: true, // Asegura que las barras/líneas se apilen
                    beginAtZero: true, 
                    border: { display: false }, 
                    grid: { borderDash: [5, 5] } 
                }
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
    // 1. Eliminados logs de consola

    const cutOffDate = new Date('2025-11-20')
    
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*')
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })

    if (error) throw error

    globalData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');
    // 1. Eliminados logs de consola

    // Selección inicial por defecto: últimos 2 días disponibles
    selectedStart = '2025-11-26';
    selectedEnd = '2025-11-27';

    renderDateSelector();
    updateDashboard(selectedStart, selectedEnd);

    const now = new Date()
    lastUpdateLabel.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}`
    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    console.error("Error loading dashboard:", err) // Este log de error es útil mantenerlo
    loader.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`
  }
}

loadData()
