import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

// --- VISUAL CONFIGURATION ---
// Using colors closer to the reference image style
const brandPalette = {
  'M1': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.6)' }, // Blue strong
  'K1': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.6)' }, // Emerald
  'B1': { border: '#f97316', bg: 'rgba(249, 115, 22, 0.6)' }, // Orange strong
  'B2': { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.6)' }, // Purple
  'B3': { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.6)' }, // Sky blue
  'B4': { border: '#84cc16', bg: 'rgba(132, 204, 22, 0.6)' }, // Lime
  'M2': { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.6)' }, // Red
}

const defaultColors = ['#64748b', '#94a3b8', '#cbd5e1']

function getBrandColor(brand, index) {
  if (brandPalette[brand]) return brandPalette[brand]
  const color = defaultColors[index % defaultColors.length]
  return { border: color, bg: color + '99' }
}

// Format changed to English (US)
function formatDate(dateString) {
  const date = new Date(dateString)
  // Adjust timezone offset
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
  // Change locale to en-US
  return adjustedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function loadData() {
  const loader = document.getElementById('loader')
  const content = document.getElementById('dashboard-content')
  const lastUpdateLabel = document.getElementById('last-update')

  try {
    console.log("🔄 Starting data load...")

    const cutOffDate = new Date()
    cutOffDate.setDate(cutOffDate.getDate() - 15) // Last 15 days

    // 1️⃣ QUERY THE SQL VIEW
    let { data, error } = await supabase
      .from('daily_brand_counts') 
      .select('*')
      .gte('day', cutOffDate.toISOString())
      .order('day', { ascending: true })

    if (error) throw error

    // 2️⃣ FILTER: Hide SYSTEM and Otros
    const cleanData = data.filter(d => d.brand !== 'SYSTEM' && d.brand !== 'Otros');

    console.log(`✅ Data received: ${cleanData.length} rows (Optimized summary)`) 

    // --- DATA PROCESSING ---
    const pivot = {}
    const brandsSet = new Set()
    const brandTotals = {} // Object to store total volume per brand
    
    cleanData.forEach(d => {
      const date = formatDate(d.day) 
      const brand = d.brand
      const count = d.total_count 

      brandsSet.add(brand)
      
      // Calculate totals for sorting columns later
      brandTotals[brand] = (brandTotals[brand] || 0) + count;

      if (!pivot[date]) pivot[date] = {}
      pivot[date][brand] = count
    })

    const foundBrands = Array.from(brandsSet)
    
    // 3️⃣ SORTING BRANDS (Columns) DESCENDING BY TOTAL VOLUME
    const sortedBrands = foundBrands.sort((a, b) => {
        // Sort by total volume descending (b - a)
        return brandTotals[b] - brandTotals[a];
    });

    const sortedDates = Object.keys(pivot)

    // --- TABLE RENDERING ---
    const theadRow = document.getElementById('table-header-row')
    const tbody = document.getElementById('table-body')
    
    // Headers with English text and better styling
    theadRow.innerHTML = '<th class="px-4 py-3 text-left font-semibold text-slate-600">DATE</th>'
    sortedBrands.forEach(b => {
        // Use brand color for column header text for visual cues
        const colorStyle = brandPalette[b] ? `style="color: ${brandPalette[b].border}"` : '';
        theadRow.innerHTML += `<th class="px-4 py-3 text-center font-semibold" ${colorStyle}>${b}</th>`
    })
    theadRow.innerHTML += '<th class="px-4 py-3 text-right font-bold text-slate-700">TOTAL</th>'

    tbody.innerHTML = ''
    
    // Invert dates (newest first)
    ;[...sortedDates].reverse().forEach(date => {
        const tr = document.createElement('tr')
        tr.className = "border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
        
        let rowHtml = `<td class="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">${date}</td>`
        let total = 0
        
        sortedBrands.forEach(brand => {
            const count = pivot[date][brand] || 0
            total += count
            // Simpler styling for cells, closer to reference
            const textClass = count === 0 ? 'text-slate-300' : 'text-slate-600 font-medium'
            rowHtml += `<td class="px-4 py-4 text-center ${textClass}">${count > 0 ? count.toLocaleString() : '-'}</td>`
        })
        
        rowHtml += `<td class="px-4 py-4 text-right font-black text-slate-800">${total.toLocaleString()}</td>`
        tr.innerHTML = rowHtml
        tbody.appendChild(tr)
    })

    // --- CHART RENDERING ---
    const chartCanvas = document.getElementById('chart');
    if (window.myChartInstance) {
        window.myChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d')
    
    // Create datasets in the sorted order (highest total volume first)
    const datasets = sortedBrands.map((brand, index) => {
        const style = getBrandColor(brand, index)
        return {
            label: brand,
            data: sortedDates.map(date => pivot[date][brand] || 0),
            borderColor: style.border,
            backgroundColor: style.bg, // Using higher opacity fills
            borderWidth: 2,
            tension: 0.35, // Slightly smoother curve
            fill: true,
            pointRadius: 0, // Hide points by default like reference
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderWidth: 3
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
            layout: { padding: { top: 20 } },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end', // Align legend to the right
                    labels: { 
                        usePointStyle: true, 
                        boxWidth: 10, 
                        padding: 20,
                        font: { family: "'Inter', sans-serif", size: 13, weight: '500' },
                        color: '#475569'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    // 4️⃣ TOOLTIP STYLING (White style like reference)
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b', // Slate 800
                    bodyColor: '#334155', // Slate 700
                    borderColor: '#e2e8f0', // Slate 200
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true, // Use circles in tooltip
                    titleFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 },
                    
                    // 5️⃣ CRITICAL: ORDER TOOLTIP ITEMS DESCENDING BY VALUE
                    itemSort: function(a, b) {
                        return b.raw - a.raw; // Sort by value descending
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { family: "'Inter', sans-serif" }, color: '#94a3b8', maxRotation: 0 }
                },
                y: {
                    stacked: true,
                    grid: { color: '#f1f5f9', drawBorder: false, borderDash: [5, 5] }, // Dashed grid lines
                    beginAtZero: true,
                    border: { display: false },
                    ticks: { font: { family: "'Inter', sans-serif" }, color: '#94a3b8', padding: 10 }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            elements: {
                line: { borderJoinStyle: 'round' }
            }
        }
    })

    const now = new Date()
    lastUpdateLabel.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}`

    loader.classList.add('hidden')
    content.classList.remove('hidden')

  } catch (err) {
    console.error("Error loading dashboard:", err)
    loader.innerHTML = `<p class="text-red-500">Error loading data. Check console (F12).</p>`
  }
}

loadData()
