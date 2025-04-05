function parseDate(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?$/.test(dateStr)) {
    return new Date(dateStr.replace(' ', 'T'));
  }
  if (/^\d{8}$/.test(dateStr)) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  }
  return null;
}

function isThisWeek(date) {
  const now = new Date();
  const oneWeekLater = new Date();
  oneWeekLater.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekLater;
}

fetch('https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV')
  .then(response => response.text())
  .then(csvData => {
    const parsed = Papa.parse(csvData, { header: true });
    const releases = parsed.data;

    const upcoming = releases.filter(item => {
      const date = parseDate(item.DTSTART);
      return date && isThisWeek(date);
    });

    const list = document.getElementById('release-list');
    list.innerHTML = '';

    const intro = document.createElement('p');
    intro.style.fontWeight = 'bold';
    intro.style.marginBottom = '1em';
    intro.textContent = 'The following key indicators will be released next week:';
    list.parentNode.insertBefore(intro, list);

    if (upcoming.length === 0) {
      list.innerHTML = '<li>No releases in the coming week.</li>';
    } else {
      upcoming.forEach(item => {
        const date = parseDate(item.DTSTART);
        const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
        const fullDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${weekday}, ${fullDate} – ${item.SUMMARY || 'Unnamed release'}</strong>
          ${item.LOCATION ? `<br><span>${item.LOCATION}</span>` : ''}
        `;
        list.appendChild(li);
      });
    }
  })
  .catch(err => {
    document.getElementById('release-list').innerHTML = 'Failed to load data.';
    console.error('CSV fetch/parse error:', err);
  });
