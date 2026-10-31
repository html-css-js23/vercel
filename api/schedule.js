// Fetches the school ICS feed and returns lessons grouped by day (local school time, Asia/Dubai).
const FALLBACK_NOTE = 'ICS_URL is not set';

function unfold(t) { return t.replace(/\r?\n[ \t]/g, ''); }
function unescapeText(s) { return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim(); }
function parseStamp(v) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v || '');
  return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` } : null;
}

module.exports = async (req, res) => {
  const url = process.env.ICS_URL;
  if (!url) return res.status(500).json({ error: FALLBACK_NOTE });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('Calendar feed returned ' + r.status);
    const text = unfold(await r.text());
    const days = {};
    for (const block of text.split('BEGIN:VEVENT').slice(1)) {
      const get = (k) => {
        const m = new RegExp('^' + k + '[^:\\n]*:(.*)$', 'm').exec(block);
        return m ? m[1].trim() : '';
      };
      const s = parseStamp(get('DTSTART'));
      const e = parseStamp(get('DTEND'));
      if (!s || !e || s.date !== e.date) continue;
      (days[s.date] = days[s.date] || []).push({
        start: s.time, end: e.time,
        subject: unescapeText(get('SUMMARY')),
        room: unescapeText(get('LOCATION')),
      });
    }
    for (const d of Object.values(days)) d.sort((a, b) => a.start.localeCompare(b.start));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({ fetched: new Date().toISOString(), days });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
