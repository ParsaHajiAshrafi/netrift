const $ = (selector) => document.querySelector(selector);
const history = [];
const changes = [];
let previousSignature = null;

function healthScore(snapshot) {
  let score = 100;
  if (!snapshot.dns.ok) score -= 35;
  if (!snapshot.tcp.ok) score -= 35;
  score -= snapshot.targets.filter((item) => !item.ok).length * 10;
  if (!snapshot.interfaces.length) score = 0;
  if (snapshot.dns.latency > 500) score -= 10;
  return Math.max(0, score);
}

function metric(selector, result) {
  $(selector).textContent = result.ok ? `${result.latency} ms` : 'FAILED';
  $(selector).style.color = result.ok ? 'var(--text)' : 'var(--red)';
}

function renderChart() {
  const svg = $('#chart');
  const items = history.slice(-60);
  if (items.length < 2) return;
  const values = items.flatMap((item) => [item.dns.latency || 0, item.tcp.latency || 0]);
  const max = Math.max(100, ...values);
  const points = (key) => items.map((item, index) => {
    const x = (index / (items.length - 1)) * 900;
    const y = 220 - Math.min(210, ((item[key].latency || 0) / max) * 200);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lines = [40, 100, 160, 220].map((y) => `<line class="gridline" x1="0" x2="900" y1="${y}" y2="${y}"/>`).join('');
  svg.innerHTML = `<defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#52f4b1" stop-opacity=".18"/><stop offset="1" stop-color="#52f4b1" stop-opacity="0"/></linearGradient></defs>${lines}<polygon class="area" points="0,220 ${points('dns')} 900,220"/><polyline class="dns-line" points="${points('dns')}"/><polyline class="tcp-line" points="${points('tcp')}"/>`;
}

function render(snapshot) {
  history.push(snapshot);
  if (history.length > 120) history.shift();
  const diagnosis = snapshot.diagnosis;
  const card = $('#status-card');
  card.className = `status-card ${diagnosis.level}`;
  card.querySelector('.status-icon').textContent = diagnosis.level === 'healthy' ? '✓' : diagnosis.level === 'degraded' ? '!' : '×';
  $('#diagnosis').textContent = diagnosis.message;
  $('#timestamp').textContent = `Last probe ${new Date(snapshot.timestamp).toLocaleTimeString()} · ${snapshot.platform}`;
  $('#score').textContent = healthScore(snapshot);
  metric('#dns', snapshot.dns);
  metric('#tcp', snapshot.tcp);
  $('#dns-state').textContent = snapshot.dns.ok ? `${snapshot.dns.answers.length} answers` : snapshot.dns.error;
  $('#links').textContent = snapshot.interfaces.length;
  $('#link-names').textContent = snapshot.interfaces.map((item) => item.name).join(', ') || 'none detected';
  $('#vpn').textContent = snapshot.vpn.length ? 'ON' : 'OFF';
  $('#vpn-names').textContent = snapshot.vpn.join(', ') || 'no tunnel detected';
  $('#endpoints').innerHTML = snapshot.targets.map((item) => `<div class="endpoint ${item.ok ? '' : 'failed'}"><i class="endpoint-dot"></i><div><strong>${item.name}</strong><small>${item.status ? `HTTP ${item.status}` : item.error || 'No response'}</small></div><code>${item.latency}ms</code></div>`).join('');
  if (previousSignature && previousSignature !== snapshot.signature) {
    changes.unshift({ time: snapshot.timestamp, cause: diagnosis.cause, message: diagnosis.message });
    if (changes.length > 12) changes.pop();
  }
  previousSignature = snapshot.signature;
  $('#changes').textContent = changes.length;
  $('#log').innerHTML = changes.length ? changes.map((item) => `<div class="log-row"><time>${new Date(item.time).toLocaleTimeString()}</time><b>${item.cause.toUpperCase()}</b><span>${item.message}</span></div>`).join('') : '<div class="empty">No changes recorded yet. Keep this tab open while you work.</div>';
  renderChart();
}

fetch('/api/snapshot').then((response) => response.json()).then((data) => data.history.forEach(render));
const events = new EventSource('/api/events');
events.onmessage = (event) => render(JSON.parse(event.data));
events.onerror = () => { $('#pulse').style.background = 'var(--red)'; };
