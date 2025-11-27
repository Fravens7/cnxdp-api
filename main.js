import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)

async function loadData() {
  let { data, error } = await supabase
    .from('messages')
    .select('date, brand')

  if (error) { console.error(error); return }

  const grouped = {}
  data.forEach(d => {
    const key = `${d.date}|${d.brand}`
    grouped[key] = (grouped[key] || 0) + 1
  })

  // Tabla
  const tbody = document.querySelector('#data-table tbody')
  for (let key in grouped) {
    const [date, brand] = key.split('|')
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${date}</td><td>${brand}</td><td>${grouped[key]}</td>`
    tbody.appendChild(tr)
  }

  // Gráfico
  const labels = [...new Set(data.map(d => d.date))].sort()
  const brands = [...new Set(data.map(d => d.brand))]
  const datasets = brands.map(brand => ({
    label: brand,
    data: labels.map(date => grouped[`${date}|${brand}`] || 0),
    backgroundColor: '#' + Math.floor(Math.random() * 16777215).toString(16)
  }))

  new Chart(document.getElementById('chart'), {
    type: 'bar',
    data: { labels, datasets },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  })
}

loadData()
