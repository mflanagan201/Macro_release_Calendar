fetch('https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV')
  .then(response => response.text())
  .then(csvData => {
    const parsed = Papa.parse(csvData, { header: true });
    displayData(parsed.data);
  })
  .catch(err => {
    document.getElementById('data-container').textContent = 'Failed to load data.';
    console.error(err);
  });

function displayData(data) {
  const container = document.getElementById('data-container');
  const table = document.createElement('table');

  const headers = Object.keys(data[0]);
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  const tbody = table.createTBody();
  data.forEach(row => {
    const tr = tbody.insertRow();
    headers.forEach(header => {
      const td = tr.insertCell();
      td.textContent = row[header] || '';
    });
  });

  container.innerHTML = '';
  container.appendChild(table);
}