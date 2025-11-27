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

// VARIABLES GLOBALES
let globalData = [];
let maxAvailableDate = ''; 
// CAMBIO IMPORTANTE: Usamos un Set para guardar fechas individuales, no un rango start/end
let selectedDates = new Set(); 
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

// --- RENDERIZADO DEL SELECTOR (MULTIPLE + DICIEMBRE) ---
function renderDateSelector() {
    const container = document.getElementById('date-selector-container');
    container.innerHTML = '';

    // CAMBIO 1: Rango visual extendido hasta Diciembre (ej: 5 Dic)
    const startDate = new Date('2025-11-17'); 
    const endDate = new Date('2025-12-05'); 

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate);
        const displayDay = currentDate.getDate();
        // month: 'short' mostrará "Nov" o "Dec" automáticamente
        const displayMonth = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Lógica de disponibilidad (Datos reales existen)
        const validDataStart = '2025-11-20';
        const hasData = dateKey >= validDataStart && dateKey <= maxAvailableDate;
        
        // CAMBIO 2: Verificar si está en el Set de seleccionados
        const isSelected = selectedDates.has(dateKey);

        const btn = document.createElement('button');
        
        let classes = "flex flex-col items-center justify-center px-3 py-1 rounded-lg border transition-all min-w-[55px] ";
        
        if (!hasData) {
            // OFF / FUTURO
            classes += "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50";
            btn.disabled = true;
        } else if (isSelected) {
            // ON (Seleccionado)
            classes += "bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold transform scale-105";
        } else {
            // DISPONIBLE PERO NO SELECCIONADO (Grisaceo)
            classes += "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50";
        }
        
        btn.className = classes;
        
        // Mostramos el Mes si es día 1 para dar contexto de cambio de mes
        const monthLabel = displayDay === 1 ? `<span class="text-[9px] font-bold text-indigo-200">${displayMonth.toUpperCase()}</span>` : `<span class="text-[9px] uppercase tracking-wide opacity-80">${dayName}</span>`;

        btn.innerHTML = `
            ${monthLabel}
            <span class="text-base leading-none">${displayDay}</span>
        `;

        if (hasData) {
            btn.onclick = () => handleDateClick(dateKey);
        }

        container.appendChild(btn);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// --- CAMBIO 3: LÓGICA MULTI-SELECT (TOGGLE) ---
function handleDateClick(dateKey) {
    if (selectedDates.has(dateKey)) {
        // Si ya está, lo quitamos (OFF)
        // IMPORTANTE: Evitar dejar vacío todo para que no explote el gráfico
        if (selectedDates.size > 1) {
            selectedDates.delete(dateKey);
        } else {
             // Opcional: No permitir deseleccionar el último, o dejarlo vacío
             // Aquí permitimos borrarlo pero la tabla mostrará "No data"
             selectedDates.delete(dateKey);
        }
    } else {
        // Si no está, lo agregamos (ON)
        selectedDates.add(dateKey);
    }
    
    renderDateSelector();
    updateDashboard();
}

// --- ACTUALIZACIÓN DE DATOS (Basado en el Set) ---
function updateDashboard() {
    // Convertir Set a Array y Ordenar (Crucial para el gráfico de línea)
    // localeCompare asegura que '2025-11-20' venga antes que '2025-11-22'
    const sortedSelectedKeys = Array.from(selectedDates).sort();

    const filteredData = globalData.filter(d => {
        const itemDate = d.day.split('T')[0];
        // Filtramos si la fecha está incluida en el Set de seleccionados
        return selectedDates.has(itemDate);
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
    
    // Las fechas para el eje X deben ser las que están en el Set, ordenadas
    // Pero ojo: pivot usa formato visual ("Nov 20"), el Set usa ISO ("2025-11-20").
    // Debemos mapear las keys ordenadas a su formato visual.
    const chartLabels = sortedSelectedKeys.map(isoDate => formatDisplayDate(isoDate));

    renderTable(sortedBrands, chartLabels, pivot);
    renderChart(sortedBrands, chartLabels, pivot);
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
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-8 text-center text-slate-400">No dates selected</td></tr>';
        return;
    }

    // Invertir para mostrar lo más reciente arriba en la tabla
    [...sortedDates].reverse().forEach(date => {
        const tr = document.createElement('tr')
        tr.className = "border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
        let rowHtml = `<td class="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">${date}</td>`
        let total = 0
        sortedBrands.forEach(brand => {
            const count = (pivot[date] && pivot[date][brand]) || 0
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
    if (chartInstance) chartInstance.destroy();

    const ctx = chartCanvas.getContext('2d')
    
    const isSingleDay = sortedDates.length === 1;

    // Etiquetas para el gráfico
    const chartLabels = isSingleDay ? ['', sortedDates[0], ' '] : sortedDates;

    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        
        const originalData = sortedDates.map(date => (pivot[date] && pivot[date][brand]) || 0);
        
        // Repetir dato si es 1 día para efecto horizonte
        const chartData = isSingleDay ? [originalData[0], originalData[0], originalData[0]] : originalData;

        return {
            label: brand,
            data: chartData,
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            tension: isSingleDay ? 0 : 0.35,
            fill: true,
            pointRadius: isSingleDay ? [0, 5, 0] : 0, 
            pointHoverRadius: 7,
            pointBackgroundColor: '#ffffff',
            pointBorderWidth: 2
        }
    })

    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { labels: chartLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 10, right: 10, top: 20, bottom: 0 } },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12, 
                    bodySpacing: 4,
                    usePointStyle: true,
                    titleFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 },
                    itemSort: (a, b) => b.raw - a.raw,
                    callbacks: {
                         label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { maxRotation: 0, font: { family: "'Inter', sans-serif" } },
                    offset: false 
                },
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    border: { display: false }, 
                    grid: { borderDash: [5, 5], color: '#f1f5f9' } 
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
    const cutOffDate = new Date('2025-11-20')
    
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*')
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })

    if (error) throw error

    globalData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');

    // SYNC LOG
    try {
        const { data: lastMsgData } = await supabase
            .from('messages')
            .select('brand, extra1, date, id')
            .order('date', { ascending: false })
            .limit(1);

        if (lastMsgData && lastMsgData.length > 0) {
            const lastMsg = lastMsgData[0];
            const msgDate = new Date(lastMsg.date);
            const formattedDate = msgDate.toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
            });
            console.log(
                `%c[SYNC] Brand: ${lastMsg.brand} | Value: ${lastMsg.extra1 || 'N/A'} | Date: ${formattedDate}`, 
                'background: #22c55e; color: #fff; padding: 4px; border-radius: 4px; font-weight: bold;'
            );
        }
    } catch (syncErr) { console.warn(syncErr); }

    // DETECTAR HASTA DONDE TENEMOS DATOS (Para habilitar botones)
    if (globalData.length > 0) {
        const lastItem = globalData[globalData.length - 1];
        maxAvailableDate = lastItem.day.split('T')[0];
    } else {
        maxAvailableDate = '2025-11-27'; 
    }

    // CAMBIO 4: AUTO-SELECCIONAR TODO LO DISPONIBLE AL INICIO
    // Llenamos el Set con todas las fechas válidas desde el 20 hasta maxAvailableDate
    let tempDate = new Date('2025-11-20');
    const lastDate = new Date(maxAvailableDate);
    
    selectedDates.clear();
    while (tempDate <= lastDate) {
        selectedDates.add(formatDateKey(tempDate));
        tempDate.setDate(tempDate.getDate() + 1);
    }

    renderDateSelector();
    updateDashboard();

    const now = new Date()
    lastUpdateLabel.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}`
    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    loader.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`
  }
}

loadData()
