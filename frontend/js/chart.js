// Small dependency-free grouped-bar SVG chart for the dashboard trend view.
// Two series max (Petrol / HSD) using the validated categorical palette,
// fixed slot order (blue=1, orange=2), a legend, gridlines, and a hover
// tooltip - see the dataviz skill for the rules this follows.
import { formatDateLabel } from './dateutil.js';

const COLORS = {
  series1: 'var(--series-1)',
  series2: 'var(--series-2)',
};

export function renderGroupedBarChart(el, { dates, seriesA, seriesB, labelA, labelB, valueFormatter }) {
  el.innerHTML = '';
  if (!dates.length) {
    el.innerHTML = '<p class="muted">No data in this range yet.</p>';
    return;
  }
  const width = Math.max(el.clientWidth || 640, 360);
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 34, left: 56 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...seriesA, ...seriesB);
  const niceMax = niceCeiling(maxVal);
  const n = dates.length;
  const groupW = plotW / n;
  const barW = Math.max(3, Math.min(22, groupW * 0.32));
  const fmt = valueFormatter || ((v) => Math.round(v).toLocaleString());

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${labelA} and ${labelB} by day`);

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = (niceMax / yTicks) * i;
    const y = padding.top + plotH - (v / niceMax) * plotH;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', padding.left);
    line.setAttribute('x2', width - padding.right);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('class', 'chart-gridline');
    svg.appendChild(line);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', padding.left - 8);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'chart-axis-label');
    label.textContent = fmt(v);
    svg.appendChild(label);
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.style.display = 'none';
  el.style.position = 'relative';

  dates.forEach((date, i) => {
    const groupX = padding.left + i * groupW;
    const vals = [
      { v: seriesA[i] || 0, color: COLORS.series1, label: labelA },
      { v: seriesB[i] || 0, color: COLORS.series2, label: labelB },
    ];
    vals.forEach((s, j) => {
      const barH = (s.v / niceMax) * plotH;
      const x = groupX + groupW / 2 - barW - 2 + j * (barW + 4);
      const y = padding.top + plotH - barH;
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', Math.max(0, barH));
      rect.setAttribute('rx', 3);
      rect.setAttribute('fill', s.color);
      rect.addEventListener('mousemove', (ev) => {
        tooltip.style.display = 'block';
        tooltip.innerHTML = `<strong>${formatDateLabel(date)}</strong><br>${s.label}: ${fmt(s.v)}`;
        const rectBox = el.getBoundingClientRect();
        tooltip.style.left = `${ev.clientX - rectBox.left + 12}px`;
        tooltip.style.top = `${ev.clientY - rectBox.top - 12}px`;
      });
      rect.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      svg.appendChild(rect);
    });

    if (n <= 14 || i % Math.ceil(n / 14) === 0) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', groupX + groupW / 2);
      label.setAttribute('y', height - padding.bottom + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'chart-axis-label');
      label.textContent = formatDateLabel(date);
      svg.appendChild(label);
    }
  });

  const baseline = document.createElementNS(svgNS, 'line');
  baseline.setAttribute('x1', padding.left);
  baseline.setAttribute('x2', width - padding.right);
  baseline.setAttribute('y1', padding.top + plotH);
  baseline.setAttribute('y2', padding.top + plotH);
  baseline.setAttribute('class', 'chart-baseline');
  svg.appendChild(baseline);

  el.appendChild(svg);
  el.appendChild(tooltip);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = `
    <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.series1}"></span>${labelA}</span>
    <span class="legend-item"><span class="legend-swatch" style="background:${COLORS.series2}"></span>${labelB}</span>
  `;
  el.appendChild(legend);
}

function niceCeiling(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const norm = v / base;
  let niceNorm;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;
  return niceNorm * base;
}
