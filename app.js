'use strict';

/* ============================================================
   Pendientes — app web instalable para iPhone
   Todo se guarda en el teléfono (localStorage).
   ============================================================ */

const STORE_KEY = 'pendientes.v1';
const HINT_KEY = 'pendientes.hintDismissed';
const PALETTE = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#e03131', '#f08c00', '#0c8599', '#5f3dc4', '#868e96'];
const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Personal', color: '#e8590c' },
  { id: 'escuela', name: 'Escuela', color: '#1c7ed6' },
  { id: 'trabajo', name: 'Trabajo', color: '#2f9e44' },
];
const DEFAULT_REMINDER_TIME = '09:00';

let state = load();
let view = 'today';
let filter = 'all';
let editingId = null;
let pickedCategory = null;
let timers = [];

/* ---------- Utilidades ---------- */

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function parseLocal(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}
function addDays(dateStr, n) {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

const fmtLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHour = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });

function friendlyDate(dateStr) {
  const t = todayStr();
  if (dateStr === t) return 'Hoy';
  if (dateStr === addDays(t, 1)) return 'Mañana';
  if (dateStr === addDays(t, -1)) return 'Ayer';
  return cap(fmtShort.format(parseLocal(dateStr)));
}
const fmtTime = (time) => fmtHour.format(parseLocal('2000-01-01', time));

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* ---------- Datos ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.tasks) && Array.isArray(s.categories) && s.categories.length) return s;
    }
  } catch (e) { /* almacenamiento no disponible */ }
  return { categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), tasks: [] };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se pudo guardar en este dispositivo');
  }
}

function category(id) {
  return state.categories.find((c) => c.id === id) || { id, name: 'Sin categoría', color: '#868e96' };
}

const hasReminder = (t) => t.reminder !== '' && t.reminder != null && !!t.date;

function reminderDate(t) {
  if (!hasReminder(t)) return null;
  const base = parseLocal(t.date, t.time || DEFAULT_REMINDER_TIME);
  return new Date(base.getTime() - Number(t.reminder) * 60000);
}

function sortTasks(a, b) {
  const da = a.date || '9999-12-31';
  const db = b.date || '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.time || '99:99';
  const tb = b.time || '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.createdAt - b.createdAt;
}

const pendingToday = () => state.tasks.filter((t) => !t.done && t.date && t.date <= todayStr());

/* ---------- Pantalla principal ---------- */

const TITLES = { today: 'Hoy', upcoming: 'Próximos', all: 'Todos', done: 'Hechos' };

function render() {
  $('#todayLabel').textContent = cap(fmtLong.format(new Date()));
  $('#viewTitle').textContent = TITLES[view];
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  renderChips();
  renderList();
  updateBadge();
  scheduleReminders();
}

function countFor(catId) {
  const t = todayStr();
  return state.tasks.filter((x) => {
    if (catId !== 'all' && x.categoryId !== catId) return false;
    if (view === 'today') return !x.done && x.date && x.date <= t;
    if (view === 'upcoming') return !x.done && x.date && x.date > t;
    if (view === 'done') return x.done;
    return !x.done;
  }).length;
}

function renderChips() {
  const wrap = $('#categoryChips');
  wrap.replaceChildren();
  const make = (id, name, color) => {
    const b = el('button', { type: 'button', className: 'chip' + (filter === id ? ' active' : '') });
    if (color) {
      b.style.setProperty('--c', color);
      b.append(el('span', { className: 'dot' }));
    }
    b.append(name);
    const n = countFor(id);
    if (n) b.append(el('span', { className: 'count', textContent: String(n) }));
    b.addEventListener('click', () => { filter = id; render(); });
    wrap.append(b);
  };
  make('all', 'Todas');
  state.categories.forEach((c) => make(c.id, c.name, c.color));
}

function renderList() {
  const t = todayStr();
  const tasks = state.tasks.filter((x) => filter === 'all' || x.categoryId === filter);
  const groups = [];

  if (view === 'today') {
    const pending = tasks.filter((x) => !x.done && x.date && x.date <= t).sort(sortTasks);
    const overdue = pending.filter((x) => x.date < t);
    const today = pending.filter((x) => x.date === t);
    const doneToday = tasks.filter((x) => x.done && x.doneAt && ymd(new Date(x.doneAt)) === t);
    if (overdue.length) groups.push({ title: 'Atrasados', items: overdue, cls: 'overdue' });
    if (today.length) groups.push({ title: 'Para hoy', items: today });
    if (doneToday.length) groups.push({ title: 'Hechos hoy', items: doneToday });
  } else if (view === 'upcoming') {
    const byDate = new Map();
    tasks.filter((x) => !x.done && x.date && x.date > t).sort(sortTasks).forEach((x) => {
      if (!byDate.has(x.date)) byDate.set(x.date, []);
      byDate.get(x.date).push(x);
    });
    byDate.forEach((items, d) => groups.push({ title: friendlyDate(d), items }));
  } else if (view === 'all') {
    const pending = tasks.filter((x) => !x.done);
    state.categories
      .filter((c) => filter === 'all' || c.id === filter)
      .forEach((c) => {
        const items = pending.filter((x) => x.categoryId === c.id).sort(sortTasks);
        if (items.length) groups.push({ title: c.name, items });
      });
  } else {
    const done = tasks.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    if (done.length) groups.push({ title: done.length === 1 ? '1 completado' : `${done.length} completados`, items: done });
  }

  const list = $('#list');
  list.replaceChildren();

  if (!groups.length) {
    list.append(emptyState());
    return;
  }

  for (const g of groups) {
    const ul = el('ul');
    g.items.forEach((task) => ul.append(taskItem(task)));
    list.append(el('section', { className: 'group' + (g.cls ? ' ' + g.cls : '') }, el('h2', { textContent: g.title }), ul));
  }

  if (view === 'done') {
    const btn = el('button', { type: 'button', className: 'clear-done', textContent: 'Borrar completados' });
    btn.addEventListener('click', clearDone);
    list.append(btn);
  }
}

function emptyState() {
  const msgs = {
    today: ['☀️', 'Nada pendiente para hoy', 'Toca + para agregar algo.'],
    upcoming: ['🗓️', 'Sin pendientes próximos', 'Los pendientes con fecha futura aparecen aquí.'],
    all: ['✨', 'Todo en orden', 'No tienes pendientes en esta categoría.'],
    done: ['✅', 'Aún no completas nada', 'Toca el círculo de un pendiente para marcarlo.'],
  };
  const [icon, title, sub] = msgs[view];
  return el('div', { className: 'empty' },
    el('div', { className: 'big', textContent: icon }),
    el('p', {}, el('strong', { textContent: title })),
    el('p', { textContent: sub }));
}

function taskItem(task) {
  const c = category(task.categoryId);
  const t = todayStr();
  const li = el('li', { className: 'task' + (task.done ? ' done' : '') });
  li.style.setProperty('--c', c.color);

  const check = el('button', { type: 'button', className: 'check' });
  check.setAttribute('aria-label', task.done ? 'Marcar como pendiente' : 'Marcar como hecho');
  check.addEventListener('click', () => toggleDone(task.id));

  const meta = el('span', { className: 'meta' });
  const addMeta = (node) => {
    if (meta.childNodes.length) meta.append(el('span', { className: 'sep' }));
    meta.append(node);
  };
  if (view !== 'all' || filter === 'all') addMeta(c.name);
  if (task.date && view !== 'upcoming' && task.date !== t) {
    const late = !task.done && task.date < t;
    addMeta(el('span', { className: late ? 'late' : '', textContent: friendlyDate(task.date) }));
  }
  if (task.time) addMeta(fmtTime(task.time));
  if (hasReminder(task) && !task.done) addMeta('🔔');
  if (task.notes) addMeta('📝');

  const body = el('button', { type: 'button', className: 'body' },
    el('span', { className: 'title', textContent: task.title }), meta);
  body.addEventListener('click', () => openTask(task.id));

  li.append(check, body);
  return li;
}

function toggleDone(id) {
  const task = state.tasks.find((x) => x.id === id);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? Date.now() : null;
  save();
  render();
  if (task.done) {
    const left = pendingToday().length;
    toast(left === 0 && task.date && task.date <= todayStr() ? '🎉 ¡Terminaste lo de hoy!' : '✓ Hecho');
  }
}

function clearDone() {
  const n = state.tasks.filter((x) => x.done).length;
  if (!n || !confirm(`¿Borrar ${n} pendiente${n === 1 ? '' : 's'} completado${n === 1 ? '' : 's'}?`)) return;
  state.tasks = state.tasks.filter((x) => !x.done);
  save();
  render();
}

/* ---------- Nuevo / editar pendiente ---------- */

const F = (name) => $('#taskForm').elements[name];

function renderCatPicker() {
  const wrap = $('#catPicker');
  wrap.replaceChildren();
  state.categories.forEach((c) => {
    const b = el('button', { type: 'button', className: 'cat-option' }, el('span', { className: 'dot' }), c.name);
    b.style.setProperty('--c', c.color);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c.id === pickedCategory));
    b.addEventListener('click', () => { pickedCategory = c.id; renderCatPicker(); });
    wrap.append(b);
  });
}

function openTask(id) {
  const task = id ? state.tasks.find((x) => x.id === id) : null;
  editingId = task ? task.id : null;

  pickedCategory = task ? task.categoryId : (filter !== 'all' ? filter : state.categories[0].id);
  if (!state.categories.some((c) => c.id === pickedCategory)) pickedCategory = state.categories[0].id;
  renderCatPicker();

  F('taskTitle').value = task ? task.title : '';
  F('date').value = task ? task.date : (view === 'today' ? todayStr() : '');
  F('time').value = task ? task.time : '';
  F('reminder').value = task && hasReminder(task) ? String(task.reminder) : '';
  F('notes').value = task ? task.notes || '' : '';
  updateReminderHelp();

  $('#taskDialogTitle').textContent = task ? 'Editar' : 'Nuevo pendiente';
  $('#deleteTaskBtn').hidden = !task;
  $('#calendarBtn').hidden = !(task && task.date);

  $('#taskDialog').showModal();
  if (!task) setTimeout(() => F('taskTitle').focus(), 60);
}

function updateReminderHelp() {
  $('#reminderHelp').hidden = !(F('reminder').value !== '' && !F('time').value);
}

function saveTask(e) {
  e.preventDefault();
  const title = F('taskTitle').value.trim();
  if (!title) {
    F('taskTitle').focus();
    toast('Escribe qué tienes que hacer');
    return;
  }
  let date = F('date').value;
  const time = F('time').value;
  const reminder = F('reminder').value;
  if (!date && (time || reminder !== '')) date = todayStr();

  const data = {
    title,
    categoryId: pickedCategory,
    date,
    time,
    reminder: reminder === '' ? '' : Number(reminder),
    notes: F('notes').value.trim(),
    notified: false,
  };

  if (editingId) {
    Object.assign(state.tasks.find((x) => x.id === editingId), data);
  } else {
    state.tasks.push({ id: uid(), done: false, doneAt: null, createdAt: Date.now(), ...data });
  }
  save();
  $('#taskDialog').close();
  render();

  if (data.reminder !== '' && notifPermission() === 'default') {
    toast('Activa los avisos en Ajustes ⚙︎');
  } else {
    toast(editingId ? 'Guardado' : 'Pendiente agregado');
  }
}

function deleteTask() {
  if (!editingId || !confirm('¿Eliminar este pendiente?')) return;
  state.tasks = state.tasks.filter((x) => x.id !== editingId);
  save();
  $('#taskDialog').close();
  render();
  toast('Eliminado');
}

/* ---------- Ajustes: categorías ---------- */

function renderCatList() {
  const ul = $('#catList');
  ul.replaceChildren();
  state.categories.forEach((c) => {
    const swatch = el('button', { type: 'button', className: 'color-swatch' });
    swatch.style.setProperty('--c', c.color);
    swatch.setAttribute('aria-label', `Cambiar color de ${c.name}`);
    swatch.addEventListener('click', () => {
      c.color = PALETTE[(PALETTE.indexOf(c.color) + 1) % PALETTE.length];
      save(); renderCatList(); render();
    });

    const name = el('input', { type: 'text', value: c.name, maxLength: 30 });
    name.setAttribute('aria-label', 'Nombre de la categoría');
    name.addEventListener('change', () => {
      const v = name.value.trim();
      if (v) { c.name = v; save(); render(); } else { name.value = c.name; }
    });

    const li = el('li', {}, swatch, name);
    if (state.categories.length > 1) {
      const rm = el('button', { type: 'button', className: 'remove', textContent: 'Quitar' });
      rm.addEventListener('click', () => removeCategory(c.id));
      li.append(rm);
    }
    ul.append(li);
  });
}

function removeCategory(id) {
  const c = category(id);
  const others = state.categories.filter((x) => x.id !== id);
  const n = state.tasks.filter((t) => t.categoryId === id).length;
  const msg = n
    ? `¿Quitar "${c.name}"? Sus ${n} pendiente${n === 1 ? '' : 's'} pasará${n === 1 ? '' : 'n'} a "${others[0].name}".`
    : `¿Quitar "${c.name}"?`;
  if (!confirm(msg)) return;
  state.tasks.forEach((t) => { if (t.categoryId === id) t.categoryId = others[0].id; });
  state.categories = others;
  if (filter === id) filter = 'all';
  save(); renderCatList(); render();
}

function addCategory(e) {
  e.preventDefault();
  const input = e.target.elements.catName;
  const name = input.value.trim();
  if (!name) return;
  const used = new Set(state.categories.map((c) => c.color));
  const color = PALETTE.find((p) => !used.has(p)) || PALETTE[state.categories.length % PALETTE.length];
  state.categories.push({ id: uid(), name, color });
  input.value = '';
  save(); renderCatList(); render();
}

/* ---------- Avisos y número en el ícono ---------- */

const notifPermission = () => ('Notification' in window ? Notification.permission : 'unsupported');

function renderNotifStatus() {
  const p = notifPermission();
  const btn = $('#enableNotifBtn');
  const status = $('#notifStatus');
  btn.hidden = p !== 'default';
  if (p === 'granted') {
    status.textContent = '✓ Activados. El ícono muestra cuántos pendientes tienes hoy, y te aviso a la hora de cada recordatorio mientras la app siga abierta o en segundo plano.';
  } else if (p === 'denied') {
    status.textContent = 'Los avisos están bloqueados. Actívalos en Configuración del iPhone › Notificaciones › Pendientes.';
  } else if (p === 'unsupported') {
    status.textContent = isIOS() && !isStandalone()
      ? 'Primero agrega la app a tu pantalla de inicio (Compartir › Agregar a inicio) y ábrela desde ahí para activar avisos.'
      : 'Este navegador no admite avisos.';
  } else {
    status.textContent = 'Muestra en el ícono el número de pendientes del día y avisos de tus recordatorios.';
  }
}

async function enableNotifications() {
  if (!('Notification' in window)) { renderNotifStatus(); return; }
  try {
    const p = await Notification.requestPermission();
    if (p === 'granted') toast('Avisos activados');
  } catch (e) { /* ignorado */ }
  renderNotifStatus();
  render();
}

function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  const n = pendingToday().length;
  try {
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  } catch (e) { /* ignorado */ }
}

function scheduleReminders() {
  timers.forEach(clearTimeout);
  timers = [];
  const now = Date.now();
  for (const t of state.tasks) {
    if (t.done || t.notified) continue;
    const r = reminderDate(t);
    if (!r) continue;
    const ms = r.getTime() - now;
    if (ms <= 0) {
      // Pasó mientras la app estaba cerrada: lo mostramos al abrir (hasta 12 h después).
      if (ms > -12 * 3600e3) fireReminder(t, true);
      else { t.notified = true; save(); }
    } else if (ms < 2147483647) {
      timers.push(setTimeout(() => fireReminder(t, false), ms));
    }
  }
}

async function fireReminder(task, missed) {
  task.notified = true;
  save();
  const c = category(task.categoryId);
  const when = task.time ? fmtTime(task.time) : friendlyDate(task.date);
  toast(`🔔 ${task.title}`);
  if (missed || notifPermission() !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(task.title, {
      body: `${c.name} · ${when}`,
      tag: task.id,
      icon: 'icons/icon-192.png',
    });
  } catch (e) { /* ignorado */ }
}

/* ---------- Calendario del iPhone (.ics) ---------- */

const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsUtc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const icsLocal = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsDuration = (min) => (min < 0 ? `-PT${-min}M` : `PT${min}M`);

function icsEvent(t) {
  const c = category(t.categoryId);
  const lines = ['BEGIN:VEVENT', `UID:${t.id}@pendientes`, `DTSTAMP:${icsUtc(new Date())}`];
  let alarmOffset; // minutos relativos al inicio del evento
  if (t.time) {
    const start = parseLocal(t.date, t.time);
    lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(new Date(start.getTime() + 30 * 60000))}`);
    alarmOffset = -Number(t.reminder);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${t.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, '')}`);
    alarmOffset = 9 * 60 - Number(t.reminder); // relativo a la medianoche → 9:00 a. m.
  }
  lines.push(`SUMMARY:${icsEscape(`${t.title} (${c.name})`)}`, `CATEGORIES:${icsEscape(c.name)}`);
  if (t.notes) lines.push(`DESCRIPTION:${icsEscape(t.notes)}`);
  if (hasReminder(t)) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:${icsDuration(alarmOffset)}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

const buildIcs = (tasks) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pendientes//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...tasks.flatMap(icsEvent), 'END:VCALENDAR'].join('\r\n');

async function deliverFile(name, type, text) {
  const file = new File([text], name, { type });
  // En la app instalada usamos el menú Compartir; en Safari, la descarga normal.
  if (isStandalone() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function exportTaskToCalendar() {
  const task = state.tasks.find((x) => x.id === editingId);
  if (!task || !task.date) return;
  deliverFile('pendiente.ics', 'text/calendar', buildIcs([task]));
}

function exportAllToCalendar() {
  const now = Date.now();
  const tasks = state.tasks.filter((t) => !t.done && hasReminder(t) && reminderDate(t).getTime() > now);
  if (!tasks.length) {
    toast('No hay recordatorios futuros para enviar');
    return;
  }
  deliverFile('pendientes.ics', 'text/calendar', buildIcs(tasks));
}

/* ---------- Respaldo ---------- */

function backup() {
  deliverFile(`pendientes-respaldo-${todayStr()}.json`, 'application/json', JSON.stringify(state, null, 2));
}

async function restore(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks) || !Array.isArray(data.categories) || !data.categories.length) throw new Error('formato');
    if (!confirm(`¿Reemplazar todo con el respaldo? (${data.tasks.length} pendientes)`)) return;
    state = data;
    filter = 'all';
    save(); renderCatList(); render();
    toast('Respaldo restaurado');
  } catch (err) {
    toast('Ese archivo no es un respaldo válido');
  }
}

/* ---------- Notificación interna ---------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- Arranque ---------- */

function wire() {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => { view = b.dataset.view; render(); window.scrollTo({ top: 0 }); }));

  $('#addBtn').addEventListener('click', () => openTask(null));
  $('#taskForm').addEventListener('submit', saveTask);
  $('#deleteTaskBtn').addEventListener('click', deleteTask);
  $('#calendarBtn').addEventListener('click', exportTaskToCalendar);
  F('reminder').addEventListener('change', updateReminderHelp);
  F('time').addEventListener('change', updateReminderHelp);
  document.querySelectorAll('[data-quick]').forEach((b) =>
    b.addEventListener('click', () => {
      F('date').value = b.dataset.quick === '' ? '' : addDays(todayStr(), Number(b.dataset.quick));
    }));

  $('#settingsBtn').addEventListener('click', () => {
    renderCatList();
    renderNotifStatus();
    $('#settingsDialog').showModal();
  });
  $('#addCatForm').addEventListener('submit', addCategory);
  $('#enableNotifBtn').addEventListener('click', enableNotifications);
  $('#exportCalBtn').addEventListener('click', exportAllToCalendar);
  $('#backupBtn').addEventListener('click', backup);
  $('#restoreInput').addEventListener('change', restore);

  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  if (isIOS() && !isStandalone()) {
    let dismissed = false;
    try { dismissed = localStorage.getItem(HINT_KEY) === '1'; } catch (e) { /* ignorado */ }
    $('#installHint').hidden = dismissed;
  }
  $('#dismissHint').addEventListener('click', () => {
    $('#installHint').hidden = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* ignorado */ }
  });

  // Al volver a la app: refresca "Hoy" (por si cambió el día) y los recordatorios.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

wire();
render();
