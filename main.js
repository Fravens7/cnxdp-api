import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { iniciarAnimacionLogo } from './animations.js'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

// --- CONFIGURACIÓN VISUAL (Paleta Sólida Profesional - Tono Medio) ---
const brandPalette = {
  'M1': { border: '#1d4ed8', bg: '#3b82f6' }, 
  'K1': { border: '#047857', bg: '#10b981' }, 
  'B1': { border: '#c2410c', bg: '#f97316' }, 
  'B2': { border: '#7e22ce', bg: '#a855f7' }, 
  'B3': { border: '#0369a1', bg: '#0ea5e9' }, 
  'B4': { border: '#4d7c0f', bg: '#84cc16' }, 
  'M2': { border: '#b91c1c', bg: '#ef4444' }, 
}
const defaultColors = ['#475569', '#64748b', '#94a3b8']

// VARIABLES GLOBALES
let globalData = [];
let maxAvailableDate = ''; 
let selectedDates = new Set(); 
let chartInstance = null; 

// VARIABLES PARA EL DRAG (BARRIDO)
let isDragging = false;
let dragStartIndex = -1;
let dragMode = 'select';
let visibleDateKeys = []; 

// --- FUNCIONES UTILITARIAS ---
function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color }
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


// --- FUNCIÓN PARA FORMATEAR LOGS (CORREGIDA) ---
function formatLogTime(dateString) {
    if (!dateString) return '--:--';
    try {
        const dateObj = new Date(dateString);
        // TRUCO: Usamos 'timeZone: UTC' para que el navegador NO le sume otras 5.5 horas
        return dateObj.toLocaleTimeString('en-US', { 
            hour12: false, 
            timeZone: 'UTC' 
        });
    } catch (e) {
        // Fallback por si la fecha no es estándar
        return dateString.split(' ')[1]?.split('.')[0] || dateString;
    }
}

// --- ACTUALIZAR WIDGET DE LOGS (2 LÍNEAS) ---
async function updateLogWidget() {
    const logContainer = document.getElementById('last-update');
    
    try {
        // Traemos los últimos 2 mensajes reales
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .order('id', { ascending: false })
            .limit(2);

        if (messages && messages.length > 0) {
            let html = '';
            messages.forEach(msg => {
                const time = formatLogTime(msg.date);
                // Formato: Marca | Tipo | Usuario | ID | Hora
                html += `
                <div class="flex items-center gap-2 whitespace-nowrap">
                    <span class="font-bold text-slate-800">${msg.brand || '?'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-indigo-600 font-medium">${msg.type || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-500">${msg.extra1 || '-'}</span>
                    <span class="text-slate-300">|</span>
                    <span class="text-slate-400 text-[10px]">${msg.extra2 || '-'}</span>
                    <span class="ml-auto text-xs font-bold bg-slate-100 px-1 rounded text-slate-600">${time}</span>
                </div>`;
            });
            logContainer.innerHTML = html;
        } else {
            logContainer.innerHTML = '<span class="text-slate-400">Esperando datos...</span>';
        }
    } catch (e) {
        console.error("Error actualizando widget logs:", e);
    }
}

// --- CONFIGURACIÓN DE FLECHAS ---
function setupScrollArrows() {
    const container = document.getElementById('date-selector-container');
    const leftBtn = document.getElementById('scroll-left-btn');
    const rightBtn = document.getElementById('scroll-right-btn');

    if(leftBtn && rightBtn && container) {
        leftBtn.onclick = () => container.scrollBy({ left: -200, behavior: 'smooth' });
        rightBtn.onclick = () => container.scrollBy({ left: 200, behavior: 'smooth' });
    }
}

// --- RENDERIZADO DEL SELECTOR ---
function renderDateSelector() {
    const container = document.getElementById('date-selector-container');
    const currentScroll = container.scrollLeft;
    
    container.innerHTML = '';
    visibleDateKeys = []; 

    const startDate = new Date('2025-11-17'); 
    const endDate = new Date('2025-12-05'); 

    let currentDate = new Date(startDate);
    let index = 0;

    window.onmouseup = () => {
        if (isDragging) {
            isDragging = false;
            updateDashboard(); 
        }
    };

    while (currentDate <= endDate) {
        const dateKey = formatDateKey(currentDate);
        visibleDateKeys.push(dateKey); 

        const displayDay = currentDate.getDate();
        const displayMonth = currentDate.toLocaleDateString('en-US', { month: 'short' });
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        const validDataStart = '2025-11-20';
        const hasData = dateKey >= validDataStart && dateKey <= maxAvailableDate;
        const isSelected = selectedDates.has(dateKey);

        const btn = document.createElement('button');
        btn.id = `date-btn-${index}`; 
        
        let classes = "flex-shrink-0 flex flex-col items-center justify-center px-3 py-1 rounded-lg border transition-all w-[55px] select-none ";
        
        if (!hasData) {
            classes += "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50";
            btn.disabled = true;
        } else if (isSelected) {
            classes += "bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold transform scale-105";
        } else {
            classes += "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50";
        }
        
        btn.className = classes;
        
        const monthLabel = displayDay === 1 ? `<span class="text-[9px] font-bold text-indigo-200 pointer-events-none">${displayMonth.toUpperCase()}</span>` : `<span class="text-[9px] uppercase tracking-wide opacity-80 pointer-events-none">${dayName}</span>`;

        btn.innerHTML = `
            ${monthLabel}
            <span class="text-base leading-none pointer-events-none">${displayDay}</span>
        `;

        if (hasData) {
            btn.onmousedown = (e) => {
                e.preventDefault(); 
                isDragging = true;
                dragStartIndex = visibleDateKeys.indexOf(dateKey);
                dragMode = selectedDates.has(dateKey) ? 'deselect' : 'select';
                applySelectionLogic(dateKey);
                updateButtonStyle(btn, dateKey);
            };

            btn.onmouseenter = () => {
                if (isDragging) {
                    const currentIndex = visibleDateKeys.indexOf(dateKey);
                    handleDragSelection(currentIndex);
                }
            };
        }

        container.appendChild(btn);
        currentDate.setDate(currentDate.getDate() + 1);
        index++;
    }
    
    // Restaurar scroll
    container.scrollLeft = currentScroll;
}

// --- LÓGICA DEL BARRIDO ---
function handleDragSelection(currentIndex) {
    const start = Math.min(dragStartIndex, currentIndex);
    const end = Math.max(dragStartIndex, currentIndex);

    for (let i = start; i <= end; i++) {
        const dateKey = visibleDateKeys[i];
        applySelectionLogic(dateKey);
        const btn = document.getElementById(`date-btn-${i}`);
        if (btn && !btn.disabled) {
            updateButtonStyle(btn, dateKey);
        }
    }
}

function applySelectionLogic(dateKey) {
    if (dragMode === 'select') {
        selectedDates.add(dateKey);
    } else {
        if (selectedDates.size > 1 || dragMode === 'select') {
             selectedDates.delete(dateKey);
        }
    }
}

function updateButtonStyle(btn, dateKey) {
    const isSelected = selectedDates.has(dateKey);
    if (isSelected) {
        btn.className = "flex-shrink-0 flex flex-col items-center justify-center px-3 py-1 rounded-lg border transition-all w-[55px] select-none bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold transform scale-105";
    } else {
        btn.className = "flex-shrink-0 flex flex-col items-center justify-center px-3 py-1 rounded-lg border transition-all w-[55px] select-none bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50";
    }
}

// --- ACTUALIZACIÓN DE DATOS ---
function updateDashboard() {
    const sortedSelectedKeys = Array.from(selectedDates).sort();

    const filteredData = globalData.filter(d => {
        const itemDate = d.day.split('T')[0];
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
    const chartLabels = sortedSelectedKeys.map(isoDate => formatDisplayDate(isoDate));

    renderTable(sortedBrands, chartLabels, pivot);
    renderChart(sortedBrands, chartLabels, pivot);
}

// --- RENDER TABLE (LIMPIA + TOOLTIP EN TOTAL) ---
function renderTable(sortedBrands, sortedDates, pivot) {
    const theadRow = document.getElementById('table-header-row')
    const tbody = document.getElementById('table-body')
    
    // 1. Cabecera
    theadRow.innerHTML = '<th class="px-4 py-3 text-left font-semibold text-slate-600 w-32">DATE</th>'
    sortedBrands.forEach(b => {
        const colorStyle = brandPalette[b] ? `style="color: ${brandPalette[b].border}"` : '';
        theadRow.innerHTML += `<th class="px-4 py-3 text-right font-semibold" ${colorStyle}>${b}</th>`
    })
    theadRow.innerHTML += '<th class="px-4 py-3 text-center font-bold text-slate-700 border-l border-slate-200 bg-slate-50">TOTAL</th>'

    tbody.innerHTML = ''
    
    if (sortedDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-8 text-center text-slate-400">No dates selected</td></tr>';
        return;
    }

    const displayDates = [...sortedDates].reverse();

    displayDates.forEach((date, index) => {
        // Obtenemos la fecha anterior para comparar
        const prevDate = displayDates[index + 1];

        const tr = document.createElement('tr')
        tr.className = "border-b border-slate-50 hover:bg-slate-50/50 transition-colors group/row"
        
        // Columna Fecha
        let rowHtml = `<td class="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">${date}</td>`
        let rowTotal = 0
        let prevRowTotal = 0

        // Columnas de Marcas (LIMPIAS, SOLO NÚMEROS)
        sortedBrands.forEach(brand => {
            const count = (pivot[date] && pivot[date][brand]) || 0
            const prevCount = prevDate ? ((pivot[prevDate] && pivot[prevDate][brand]) || 0) : null;
            
            rowTotal += count
            if (prevCount !== null) prevRowTotal += prevCount;

            // Si es 0 mostramos guion, si no el numero normal
            const textClass = count === 0 ? 'text-slate-300' : 'text-slate-600 font-medium';
            const displayNum = count === 0 ? '-' : count.toLocaleString();
            rowHtml += `<td class="px-4 py-3 text-right ${textClass}">${displayNum}</td>`
        })

        // --- COLUMNA TOTAL CON MAGIA (Delta + Tooltip) ---
        // Calculamos diferencia solo para el total
        let deltaHtml = '';
        let tooltipHtml = '';
        
        if (prevDate) {
            const diff = rowTotal - prevRowTotal;
            const isReduction = diff < 0; // Bueno (Verde)
            const arrow = isReduction ? '▼' : '▲';
            const colorClass = isReduction ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
            const sign = diff > 0 ? '+' : ''; // Para que diga +20 o -20

            // 1. La pastilla pequeña (Pill) visible siempre
            deltaHtml = `
                <span class="inline-flex items-center justify-center px-1.5 py-0.5 ml-2 rounded text-[10px] font-bold ${colorClass}">
                    ${arrow} ${Math.abs(diff)}
                </span>
            `;

            // 2. El Tooltip (Ventana negra invisible que aparece al hover)
            // Frase en inglés como pediste: "Total today: X | Change: -Y vs Yesterday"
            const tooltipText = `Total today: ${rowTotal.toLocaleString()} | Change: ${sign}${diff} vs Yesterday`;
            
            tooltipHtml = `
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/total:block z-50 w-max">
                    <div class="bg-slate-800 text-white text-xs rounded py-1 px-2 shadow-lg relative">
                        ${tooltipText}
                        <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                </div>
            `;
        }

        // Construcción de la celda Total
        // Nota la clase 'group/total' y 'relative' para que funcione el tooltip
        rowHtml += `
            <td class="px-4 py-3 text-right font-black text-slate-800 border-l border-slate-200 bg-slate-50 relative group/total cursor-help">
                <div class="flex items-center justify-end">
                    <span>${rowTotal.toLocaleString()}</span>
                    ${deltaHtml}
                </div>
                ${tooltipHtml}
            </td>`
        
        tr.innerHTML = rowHtml
        tbody.appendChild(tr)
    })
}
// Función auxiliar para generar el HTML del número + la flechita
function generateTrendCell(current, previous, isTotal = false) {
    // Si el valor es 0, lo mostramos gris suave
    if (current === 0) return '<span class="text-slate-300">-</span>';

    const numHtml = `<span class="${isTotal ? 'text-lg' : 'text-sm'} text-slate-700">${current.toLocaleString()}</span>`;

    // Si no hay día anterior (es el último dato) o son iguales, solo devolvemos el número
    if (previous === null || current === previous) {
        return numHtml;
    }

    const diff = current - previous;
    const isReduction = diff < 0; // ¿Bajó el volumen? (Bueno = Verde)
    
    // Configuración de colores
    // Verde (Emerald) si bajó (bueno), Rojo (Rose) si subió (malo)
    const colorClass = isReduction ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
    const arrow = isReduction ? '▼' : '▲';
    
    // Solo mostramos la etiqueta si la diferencia es relevante (opcional, aquí mostramos todo)
    // El Math.abs(diff) quita el signo negativo porque ya usamos la flecha hacia abajo
    const badgeHtml = `
        <div class="inline-flex items-center justify-center px-1.5 py-0.5 ml-1.5 rounded text-[10px] font-bold ${colorClass} bg-opacity-60">
            <span class="mr-0.5 text-[8px]">${arrow}</span>${Math.abs(diff)}
        </div>
    `;

    return `<div class="flex items-center justify-end w-full">${numHtml}${badgeHtml}</div>`;
}

// --- RENDER CHART ---
function renderChart(sortedBrands, sortedDates, pivot) {
    const chartCanvas = document.getElementById('chart');
    if (chartInstance) chartInstance.destroy();

    const ctx = chartCanvas.getContext('2d')
    const isSingleDay = sortedDates.length === 1;
    const chartLabels = isSingleDay ? ['', sortedDates[0], ' '] : sortedDates;

    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        const originalData = sortedDates.map(date => (pivot[date] && pivot[date][brand]) || 0);
        const chartData = isSingleDay ? [originalData[0], originalData[0], originalData[0]] : originalData;

        return {
            label: brand,
            data: chartData,
            borderColor: style.border,
            backgroundColor: style.bg, 
            borderWidth: 2,
            tension: isSingleDay ? 0 : 0.35,
            fill: true,
            pointBackgroundColor: style.bg, 
            pointBorderColor: style.border,
            pointBorderWidth: 1, 
            pointRadius: isSingleDay ? [0, 5, 0] : 0, 
            pointHoverRadius: 7,
            pointHoverBackgroundColor: style.bg,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2
        }
    })

    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { labels: chartLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 10, right: 10, top: 20, bottom: 0 } },
            animation: { duration: 800 }, 
            plugins: {
                legend: { 
                    position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 }, usePointStyle: true } 
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12, 
                    bodySpacing: 6,
                    usePointStyle: true,
                    titleFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
                    bodyFont: { family: "'Roboto Mono', 'Menlo', monospace", size: 13, weight: '500' }, 
                    itemSort: (a, b) => b.raw - a.raw,
                    callbacks: {
                         label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': '; 
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
                            }
                            return label;
                        },
                        labelColor: function(context) {
                            const style = getBrandColor(context.dataset.label, context.datasetIndex);
                            return {
                                borderColor: style.border,
                                backgroundColor: style.bg, 
                                borderWidth: 1,
                                borderRadius: 2
                            };
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

// ==========================================
// ⚡️ REALTIME ENGINE ⚡️
// ==========================================
function setupRealtimeListener() {
    console.log("⚡️ Escuchando cambios en tiempo real...");
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            console.log('🔄 Nuevo mensaje! Actualizando logs...');
            updateLogWidget(); // Actualiza solo los logs al instante
            refreshDataInBackground(); // Actualiza la gráfica
        })
        .subscribe();
}

async function refreshDataInBackground() {
    try {
        const cutOffDate = new Date('2025-11-20');
        let { data, error } = await supabase
            .from('daily_brand_counts') 
            .select('*')
            .gte('day', cutOffDate.toISOString())
            .order('day', { ascending: true });

        if (error) throw error;

        globalData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');

        if (globalData.length > 0) {
            const lastItem = globalData[globalData.length - 1];
            maxAvailableDate = lastItem.day.split('T')[0];
        }

        renderDateSelector(); 
        updateDashboard();

    } catch (err) {
        console.error("Error en refresh background:", err);
    }
}

// --- CARGA INICIAL ---
async function loadData() {
  const loader = document.getElementById('loader')
  const content = document.getElementById('dashboard-content')

  try {
    const cutOffDate = new Date('2025-11-20')
    
    // Carga datos para la gráfica
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*')
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })

    if (error) throw error

    globalData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');
    
    // Carga los logs iniciales
    await updateLogWidget();

    if (globalData.length > 0) {
        const lastItem = globalData[globalData.length - 1];
        maxAvailableDate = lastItem.day.split('T')[0];
    } else {
        maxAvailableDate = '2025-11-27'; 
    }

    let tempDate = new Date('2025-11-20');
    const lastDate = new Date(maxAvailableDate);
    selectedDates.clear();
    while (tempDate <= lastDate) {
        selectedDates.add(formatDateKey(tempDate));
        tempDate.setDate(tempDate.getDate() + 1);
    }

    setupScrollArrows(); 
    renderDateSelector();
    updateDashboard();
    
    setupRealtimeListener();

    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    loader.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`
  }
}

loadData()
iniciarAnimacionLogo(brandPalette);
