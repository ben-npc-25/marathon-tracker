// Usage: node convert-log.mjs "your-log.csv"
// Converts your training CSV to the app's JSON import format.

import fs from 'fs';
import path from 'path';

const csvFile = process.argv[2];
if (!csvFile) {
  console.error('Usage: node convert-log.mjs "your-log.csv"');
  process.exit(1);
}

const raw = fs.readFileSync(csvFile, 'utf-8');

// Parse CSV rows, handling quoted fields that may contain commas/newlines
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim()); field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(f => f !== '')) rows.push(row); }
  return rows;
}

// Convert DD/MM/YYYY → YYYY-MM-DD
function toISO(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// Extract distance (km) from strings like "5.21k @ 23:10 4:27/k" or "14.74k@1:19:41"
function parseDistance(actualStr) {
  if (!actualStr) return '';
  const match = actualStr.match(/^(\d+[.,]\d+)k/i);
  if (match) return match[1].replace(',', '.');
  return '';
}

// Extract duration from strings like "5.21k @ 23:10 4:27/k" or "14.74k@1:19:41"
function parseDuration(actualStr) {
  if (!actualStr) return '';
  const match = actualStr.match(/[@\s](\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})/);
  if (match) return match[1];
  return '';
}

const rows = parseCSV(raw);
const header = rows[0]; // Week,Date,Plan,Actual,RPE (1-10),心 (1-5),Feeling,Feedback

const COL = {
  week:     0,
  date:     1,
  plan:     2,
  actual:   3,
  rpe:      4,
  mood:     5,
  feeling:  6,
  feedback: 7,
};

const days = [];
let startDate = null;
let raceDate = null;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const rawDate = row[COL.date];
  const isoDate = toISO(rawDate);
  if (!isoDate) continue;

  // Skip week summary rows (no proper date, just labels)
  if (!rawDate.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) continue;

  if (!startDate) startDate = isoDate;
  raceDate = isoDate; // last valid date becomes race date candidate

  const actual = row[COL.actual] || '';
  const rpeRaw = parseInt(row[COL.rpe]);

  days.push({
    id: isoDate,
    date: isoDate,
    plannedActivity: row[COL.plan] || '',
    actualDistance: parseDistance(actual),
    durationStr: parseDuration(actual),
    rpe: isNaN(rpeRaw) ? 5 : rpeRaw,
    feeling: row[COL.feeling] || '',
    coachFeedback: row[COL.feedback] || '',
  });
}

// The race day is the last logged entry with a known race distance (42k+)
const raceDay = days.find(d => {
  const dist = parseFloat(d.actualDistance);
  return dist >= 40;
});
if (raceDay) raceDate = raceDay.date;

const output = {
  exportVersion: 1,
  exportedAt: new Date().toISOString(),
  plan: {
    goal: 'Fukui Marathon',
    title: 'Fukui Marathon Training Log',
    startDate: startDate,
    raceDate: raceDate,
  },
  days,
};

const outFile = path.basename(csvFile, path.extname(csvFile)) + '.json';
fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
console.log(`✓ Converted ${days.length} days → ${outFile}`);
console.log(`  Start: ${startDate}  Race: ${raceDate}`);
