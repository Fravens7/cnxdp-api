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

  // Agrupar por fecha y brand
  const grouped = {}
  data.forEach(d => {
    const key = `${d.date}|${d.brand}`
    grouped[key] = (grouped[key] || 0) + 1
  })

  // Llenar tabla
  const tbody = document.querySelector('#data-table tbody')
  tbody.innerHTML = ''
  for (let key in grouped) {
    const [date, brand] = key.split('|')
    const tr = document.createElement('tr')
    tr.classList.add('hover:bg-gray-100')
    tr.innerHTML = `
      <td class="px-4 py-2">${date}</td>
      <td class="px-4 py-2">${brand}</td>
      <td class="px-4 py-2">${grouped[key]}</td>
    `
    tbody.appendChild(tr)
  }

  // Gráfico Stacked Area
  const labels = [...new Set(data.map(d => d.date))].sort()
  const brands = [...new Set(data.map(d => d.brand))]
  const datasets = brands.map(brand => ({
    label: brand,
    data: labels.map(date => grouped[`${date}|${brand}`] || 0),
    fill: true,                   // área debajo de la línea
    borderColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
    backgroundColor: 'rgba(' + 
      Math.floor(Math.random()*255) + ',' + 
      Math.floor(Math.random()*255) + ',' + 
      Math.floor(Math.random()*255) + ',0.3)',
    tension: 0.3                   // suaviza las curvas
  }))

  new Chart(document.getElementById('chart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}`
            }
          }
        },
        legend: { position: 'top' }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  })
}

loadData()
