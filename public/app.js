(() => {
  const TZ = 'Asia/Dubai';
  const $ = (id) => document.getElementById(id);
  const PX = 1.7;
  let schedule = null, mail = null, state = { today: null, nextDate: null };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dubaiNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour) * 60 + (+p.minute) + (+p.second) / 60 };
  }
  const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  const fmtDur = (m) => { m = Math.max(0, Math.ceil(m)); const h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };
  const dayName = (d, opt) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, opt));

  function renderTimeline(host, lessons, live) {
    host.textContent = '';
    if (!lessons || !lessons.length) { host.appendChild(el('p', 'empty', 'No lessons on this day.')); return; }
    const tl = el('div', 'tl'); host.appendChild(tl);
    const origin = toMin(lessons[0].start);
    let prevEnd = null;
    lessons.forEach((l, i) => {
      const s = toMin(l.start), e = toMin(l.end);
      if (prevEnd != null && s - prevEnd >= 15) {
        const g = el('div', 'gap', `Break, ${s - prevEnd} min`);
        g.style.height = Math.max(24, (s - prevEnd) * PX - 6) + 'px';
        g.dataset.from = prevEnd; g.dataset.to = s; tl.appendChild(g);
      } else if (prevEnd != null && s > prevEnd) {
        const sp = el('div'); sp.style.height = (s - prevEnd) * PX + 'px'; tl.appendChild(sp);
      }
      const row = el('div', 'row'); row.dataset.s = s; row.dataset.e = e;
      row.appendChild(el('div', 't', l.start));
      const b = el('div', 'lesson');
      const txt = el('div'); txt.appendChild(el('h3', null, l.subject));
      txt.appendChild(el('div', 'meta', `${l.start} to ${l.end}`));
      b.appendChild(txt);
      if (l.room) b.appendChild(el('span', 'room', l.room));
      b.style.minHeight = Math.max(44, (e - s) * PX - 6) + 'px';
      row.appendChild(b); tl.appendChild(row);
      prevEnd = e;
    });
    if (live) tl.appendChild(el('div', 'nowline'));
  }

  function updateTimeline(host, now) {
    const tl = host.querySelector('.tl'); if (!tl) return;
    const line = tl.querySelector('.nowline');
    let pos = null;
    const items = [...tl.children].filter(c => c.classList.contains('row') || c.classList.contains('gap'));
    items.forEach(n => {
      if (n.classList.contains('row')) {
        const s = +n.dataset.s, e = +n.dataset.e, b = n.querySelector('.lesson');
        b.classList.toggle('past', now.min >= e); b.classList.toggle('now', now.min >= s && now.min < e);
        if (now.min >= s && now.min < e) pos = n.offsetTop + n.offsetHeight * ((now.min - s) / (e - s));
        else if (now.min >= e && pos == null) pos = n.offsetTop + n.offsetHeight;
      }
    });
    if (line) {
      // place between lessons during breaks by interpolating over the gap
      const gap = items.find(n => n.classList.contains('gap') && now.min >= +n.dataset.from && now.min < +n.dataset.to);
      if (gap) pos = gap.offsetTop + gap.offsetHeight * ((now.min - +gap.dataset.from) / (+gap.dataset.to - +gap.dataset.from));
      const first = items.find(n => n.classList.contains('row'));
      if (now.min < +first.dataset.s) pos = first.offsetTop;
      const last = [...items].reverse().find(n => n.classList.contains('row'));
      if (now.min >= +last.dataset.e) pos = last.offsetTop + last.offsetHeight;
      line.style.top = (pos == null ? 0 : pos) + 'px';
    }
  }

  function hero(now) {
    const day = schedule.days[now.date] || [];
    const t = $('heroTitle'), sub = $('heroSub'), when = $('heroWhen'), bar = $('heroBar'), fill = $('heroFill');
    when.textContent = dayName(now.date, { weekday: 'long', day: 'numeric', month: 'long' });
    bar.hidden = true;
    const cur = day.find(l => now.min >= toMin(l.start) && now.min < toMin(l.end));
    const upcoming = day.find(l => toMin(l.start) > now.min);
    if (cur) {
      const s = toMin(cur.start), e = toMin(cur.end);
      t.textContent = cur.subject;
      sub.textContent = `${cur.room ? 'Room ' + cur.room + ', ' : ''}${fmtDur(e - now.min)} left, ends ${cur.end}`;
      bar.hidden = false; fill.style.width = Math.round(((now.min - s) / (e - s)) * 100) + '%';
    } else if (upcoming && day.length && now.min >= toMin(day[0].start)) {
      t.textContent = 'Break';
      sub.textContent = `${upcoming.subject}${upcoming.room ? ' in ' + upcoming.room : ''} at ${upcoming.start}, in ${fmtDur(toMin(upcoming.start) - now.min)}`;
    } else if (upcoming) {
      t.textContent = 'Before school';
      sub.textContent = `${upcoming.subject}${upcoming.room ? ' in ' + upcoming.room : ''} at ${upcoming.start}, in ${fmtDur(toMin(upcoming.start) - now.min)}`;
    } else if (day.length) {
      t.textContent = 'School is out';
      sub.textContent = state.nextDate ? `Next: ${dayName(state.nextDate, { weekday: 'long' })} at ${schedule.days[state.nextDate][0].start}` : 'No more lessons scheduled.';
    } else {
      t.textContent = 'No lessons today';
      sub.textContent = state.nextDate ? `Next: ${dayName(state.nextDate, { weekday: 'long' })} at ${schedule.days[state.nextDate][0].start}, ${schedule.days[state.nextDate][0].subject}` : 'Nothing scheduled ahead.';
    }
  }

  function renderMail() {
    const host = $('view-mail'); host.textContent = '';
    if (!mail || !mail.items) { host.appendChild(el('p', 'empty', 'No email summary yet. It appears after the first refresh.')); return; }
    const head = el('div', 'mail-head');
    head.appendChild(el('span', null, `${mail.items.length} emails`));
    const upd = mail.updated ? new Date(mail.updated).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'unknown';
    head.appendChild(el('span', null, `Updated ${upd}`)); host.appendChild(head);
    const act = mail.items.filter(i => i.action), rest = mail.items.filter(i => !i.action);
    const build = (title, arr, minor) => {
      if (!arr.length) return;
      host.appendChild(el('h2', 'mail-group', title));
      const ul = el('ul', 'mail-list');
      arr.forEach(i => {
        const li = el('li', 'mail' + (i.action ? ' action' : '') + (minor ? ' minor' : ''));
        const a = el('a'); a.href = i.url || '#'; a.target = '_blank'; a.rel = 'noopener';
        a.appendChild(el('div', 'from', i.from || ''));
        a.appendChild(el('div', 'subj', i.subject || '(no subject)'));
        a.appendChild(el('p', 'sum', i.summary || ''));
        a.appendChild(el('span', 'open', 'Open in Gmail'));
        li.appendChild(a); ul.appendChild(li);
      });
      host.appendChild(ul);
    };
    build('Needs you', act, false); build('Everything else', rest, true);
    const badge = $('mailBadge'); badge.hidden = !act.length; badge.textContent = act.length;
  }

  function tick() {
    if (!schedule) return;
    const now = dubaiNow();
    const dates = Object.keys(schedule.days).filter(d => schedule.days[d].length).sort();
    state.nextDate = dates.find(d => d > now.date) || null;
    hero(now);
    updateTimeline($('view-today'), now);
  }

  function show(view) {
    ['today', 'next', 'mail'].forEach(v => { $('view-' + v).hidden = v !== view; $('tab-' + v).setAttribute('aria-selected', String(v === view)); });
    window.scrollTo({ top: 0 }); if (view === 'today') tick();
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

  async function load() {
    const [s, m] = await Promise.allSettled([fetch('/api/schedule').then(r => r.ok ? r.json() : Promise.reject(new Error('Schedule unavailable'))), fetch('/emails.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)]);
    if (m.status === 'fulfilled') mail = m.value;
    renderMail();
    if (s.status !== 'fulfilled') {
      $('heroTitle').textContent = 'Schedule offline';
      $('heroSub').textContent = 'Could not reach the school calendar. Pull to refresh when you have a connection.';
      return;
    }
    schedule = s.value;
    const now = dubaiNow();
    const dates = Object.keys(schedule.days).filter(d => schedule.days[d].length).sort();
    state.nextDate = dates.find(d => d > now.date) || null;
    renderTimeline($('view-today'), schedule.days[now.date], true);
    renderTimeline($('view-next'), state.nextDate ? schedule.days[state.nextDate] : [], false);
    $('tab-next').textContent = state.nextDate ? dayName(state.nextDate, { weekday: 'short' }) : 'Next day';
    tick();
  }
  load();
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
