// Converts a dip reading (mm) to a stock volume (liters) using a tank's
// calibration chart, via linear interpolation between the two nearest
// calibration points. Falls back gracefully at/beyond the chart's ends.
function dipToLiters(calibrationRows, dipMm) {
  if (dipMm === null || dipMm === undefined || dipMm === '') return null;
  if (!calibrationRows || calibrationRows.length === 0) return null;
  const rows = [...calibrationRows].sort((a, b) => a.dip_mm - b.dip_mm);
  const dip = Number(dipMm);

  if (dip <= rows[0].dip_mm) return rows[0].liters;
  if (dip >= rows[rows.length - 1].dip_mm) return rows[rows.length - 1].liters;

  for (let i = 0; i < rows.length - 1; i++) {
    const lo = rows[i];
    const hi = rows[i + 1];
    if (dip >= lo.dip_mm && dip <= hi.dip_mm) {
      if (hi.dip_mm === lo.dip_mm) return lo.liters;
      const ratio = (dip - lo.dip_mm) / (hi.dip_mm - lo.dip_mm);
      return lo.liters + ratio * (hi.liters - lo.liters);
    }
  }
  return null;
}

// Generates a simple straight-line placeholder calibration chart (21 points)
// for a newly created tank, so the app is usable immediately. Site owners
// should replace this with the tank's real manufacturer/dip-chart values via
// the Tanks screen for accurate readings.
function generatePlaceholderCalibration(capacityLiters, maxDipMm = 2000, points = 20) {
  const rows = [];
  for (let i = 0; i <= points; i++) {
    const dip = Math.round((maxDipMm / points) * i);
    const liters = Math.round((capacityLiters / points) * i * 100) / 100;
    rows.push({ dip_mm: dip, liters });
  }
  return rows;
}

module.exports = { dipToLiters, generatePlaceholderCalibration };
