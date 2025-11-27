import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

async function loadData() {
  let { data, error } = await supabase
    .from('messages')
    .select('date, brand')

  if (error) {
    console.error(error)
    return
  }

  // 1️⃣ Agrupar por fecha y brand
  const pivot = {}
  const brandsSet = new Set()
  data.forEach(d => {
    brandsSet.add(d.brand)
    const date = d.date
    if (!pivot[date]) pivot[date] = {}
    pivot[date][d.brand] = (pivot[date][d.brand] || 0) + 1
  })

  const brands = Array.from(brandsSet).sort() // ordena alfabéticamente, puedes personalizar

  // 2️⃣ Llenar tabla
  const tbody = document.querySelector('#data-table tbody')
  tbody.innerHTML = ''

  Object.keys(pivot).sort().forEach(date => {
    const tr = document.createElement('tr')
    tr.classList.add('hover:bg-gray-100')

    let total = 0
    let rowHtml = `<td class="px-4 py-2 font-medium">${date}</td>`

    brands.forEach(brand => {
      const count = pivot[date][brand] || 0
      total += count
      rowHtml += `<td class="px-4 py-2 text-center">${count}</td>`
    })

    rowHtml += `<td class="px-4 py-2 font-semibold text-center">${total}</td>`
    tr.innerHTML = rowHtml
    tbody.appendChild(tr)
  })

  // 3️⃣ Actualizar encabezado con brands dinámicos
  const thead = document.querySelector('#data-table thead tr')
  thead.innerHTML = '<th class="px-4 py-2">Date</th>'
  brands.forEach(b => {
    thead.innerHTML += `<th class="px-4 py-2">${b}</th>`
  })
  thead.innerHTML += '<th class="px-4 py-2">Total</th>'

  // 4️⃣ Gráfico Stacked Area (igual que antes)
  const labels = Object.keys(pivot).sort()
  const datasets = brands.map(brand => ({
    label: brand,
    data: labels.map(date => pivot[date][brand] || 0),
    fill: true,
    borderColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
    backgroundColor: 'rgba(' + 
      Math.floor(Math.random()*255) + ',' + 
      Math.floor(Math.random()*255) + ',' + 
      Math.floor(Math.random()*255) + ',0.3)',
    tension: 0.3
  }))

  new Chart(document.getElementById('chart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        tooltip: { mode: 'index', intersect: false },
        legend: { position: 'top' }
      },
      interaction: { mode: 'index', intersect: false },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  })
}

loadData()
