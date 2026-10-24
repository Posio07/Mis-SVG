/* Interfaz y persistencia. Los perfiles se guardan en localStorage del
 * dispositivo (nunca salen del teléfono) y se pueden exportar/importar en JSON. */
(function () {
  'use strict';

  const STORAGE_KEY = 'ifbb-agent:v1';
  const $ = sel => document.querySelector(sel);
  const view = $('#view');

  /* ---------- Estado y persistencia ---------- */
  let state = load();
  let ui = { tab: 'profiles', planTab: 'summary', editingId: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.profiles)) return s; }
    } catch (e) { /* almacenamiento no disponible */ }
    return { profiles: [], activeId: null };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('No se pudo guardar: almacenamiento no disponible.'); }
  }
  const active = () => state.profiles.find(p => p.id === state.activeId) || null;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayIso = () => new Date().toISOString().slice(0, 10);

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n1 = v => (Math.round(v * 10) / 10).toLocaleString('es');
  const n0 = v => Math.round(v).toLocaleString('es');
  const n2 = v => (Math.round(v * 100) / 100).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const icon = (name, cls) => `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

  /* Conteo animado de las métricas grandes del Resumen: solo la primera
   * vez que se visitan en esta sesión de la pestaña (ui.countedOnce);
   * en visitas siguientes, o con prefers-reduced-motion, el número
   * aparece directo en su valor final. */
  ui.countedOnce = ui.countedOnce || new Set();
  const statCount = (value, decimals, suffix) => `<span class="count-num" data-target="${value}" data-decimals="${decimals || 0}">0</span>${suffix ? esc(suffix) : ''}`;
  function wireCounts(container, key) {
    const nodes = container.querySelectorAll('.count-num');
    const already = ui.countedOnce.has(key);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nodes.forEach(el => {
      const target = parseFloat(el.dataset.target) || 0;
      const decimals = Number(el.dataset.decimals) || 0;
      const fmt = v => decimals ? v.toFixed(decimals).replace('.', ',') : Math.round(v).toLocaleString('es');
      if (already || reduced) { el.textContent = fmt(target); return; }
      const start = performance.now(), dur = 600;
      const tick = now => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    ui.countedOnce.add(key);
  }
  const fmtDate = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const cite = ids => (Array.isArray(ids) ? ids : [ids]).map(id => `<span class="cite" title="${esc(KNOWLEDGE.SOURCES[id] ? KNOWLEDGE.SOURCES[id].short : id)}">${esc(id)}</span>`).join('');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* Modal de confirmación con botones a medida (en vez de confirm() nativo,
   * para poder rotular "Recalcular"/"Cancelar" como pide la Fase 6). */
  function confirmModal(message, { confirmLabel = 'Continuar', cancelLabel = 'Cancelar' } = {}) {
    return new Promise(resolve => {
      const root = document.createElement('div');
      root.className = 'modal-overlay';
      root.innerHTML = `<div class="modal-card">
        <p>${esc(message)}</p>
        <div class="btn-row">
          <button class="btn" id="modal-cancel">${esc(cancelLabel)}</button>
          <button class="btn btn-primary" id="modal-confirm">${esc(confirmLabel)}</button>
        </div>
      </div>`;
      document.body.appendChild(root);
      const close = ok => { root.remove(); resolve(ok); };
      root.querySelector('#modal-cancel').onclick = () => close(false);
      root.querySelector('#modal-confirm').onclick = () => close(true);
      root.addEventListener('click', e => { if (e.target === root) close(false); });
    });
  }

  /* ---------- Navegación ---------- */
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  function go(tab) {
    ui.tab = tab;
    const apply = () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      render();
      window.scrollTo({ top: 0 });
    };
    // Fundido corto entre pestañas con la View Transitions API; si el
    // navegador no la soporta (o el usuario pide menos movimiento), el
    // cambio es instantáneo, sin fallback animado propio.
    if (document.startViewTransition && !prefersReducedMotion()) document.startViewTransition(apply);
    else apply();
  }

  function render() {
    const p = active();
    $('#active-profile-label').textContent = p ? `Perfil activo: ${p.data.name}` : 'Sin perfil activo';
    if (ui.tab === 'profiles') renderProfiles();
    else if (ui.tab === 'data') renderData();
    else if (ui.tab === 'plan') renderPlan();
    else if (ui.tab === 'progress') renderProgress();
    else renderSources();
  }

  /* ---------- Perfiles ---------- */
  function renderProfiles() {
    const items = state.profiles.map(p => {
      const div = KNOWLEDGE.DIVISIONS[p.data.division];
      const goal = { cut: 'Definición', bulk: 'Volumen', maintain: 'Mantenimiento' }[p.data.goal] || '';
      return `<div class="profile-item ${p.id === state.activeId ? 'active' : ''}" data-id="${p.id}">
        <div>
          <div class="name">${esc(p.data.name)}</div>
          <div class="meta">${esc(div ? div.label : '')} · ${goal} · ${esc(p.data.weightKg)} kg · actualizado ${fmtDate(p.updatedAt)}</div>
        </div>
        <div class="btn-row" style="margin:0">
          <button class="btn" data-act="open">Abrir</button>
        </div>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="card accent">
        <h2>Tus perfiles</h2>
        <p class="muted">Guarda tantos perfiles como quieras (tú, distintas fases, otras personas). Todo se guarda en este teléfono.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="btn-new">＋ Nuevo perfil</button>
          <button class="btn" id="btn-import">Importar JSON</button>
          <input type="file" id="file-import" accept="application/json" hidden>
        </div>
      </div>
      ${items || `<div class="empty"><div class="big">${icon('person')}</div><p>Aún no hay perfiles.<br>Crea el primero para obtener tu plan.</p></div>`}
      ${active() ? `<div class="card">
        <h3>Perfil activo: ${esc(active().data.name)}</h3>
        ${(() => { const hs = ENGINE.computeHealthScreen(ENGINE.normalizeProfile(active().data)); return hs.anyCondition ? `<p class="muted" style="font-size:.78rem">${esc(hs.disclaimer)}</p>` : ''; })()}
        <div class="btn-row">
          <button class="btn" id="btn-edit">Editar datos</button>
          <button class="btn" id="btn-dup">Duplicar</button>
          <button class="btn" id="btn-export">Exportar JSON</button>
          <button class="btn btn-danger" id="btn-del">Eliminar</button>
        </div>
      </div>` : ''}
      <p class="muted" style="font-size:.78rem">${esc(ENGINE.buildPlan({ name: 'x', age: 30, heightCm: 170, weightKg: 70 }).disclaimer)}</p>
    `;

    $('#btn-new').onclick = () => { ui.editingId = null; go('data'); };
    $('#btn-import').onclick = () => $('#file-import').click();
    $('#file-import').onchange = importJson;
    view.querySelectorAll('.profile-item').forEach(el => {
      el.querySelector('[data-act="open"]').onclick = () => { state.activeId = el.dataset.id; save(); go('plan'); };
    });
    if (active()) {
      $('#btn-edit').onclick = () => { ui.editingId = state.activeId; go('data'); };
      $('#btn-dup').onclick = () => {
        const src = active();
        const copy = { id: uid(), createdAt: todayIso(), updatedAt: todayIso(), data: Object.assign({}, src.data, { name: src.data.name + ' (copia)' }), log: [] };
        state.profiles.push(copy); state.activeId = copy.id; save(); toast('Perfil duplicado'); render();
      };
      $('#btn-export').onclick = exportJson;
      $('#btn-del').onclick = () => {
        const p = active();
        if (!confirm(`¿Eliminar el perfil "${p.data.name}"? Esta acción no se puede deshacer.`)) return;
        state.profiles = state.profiles.filter(x => x.id !== p.id);
        state.activeId = state.profiles.length ? state.profiles[0].id : null;
        save(); toast('Perfil eliminado'); render();
      };
    }
  }

  function exportJson() {
    const p = active(); if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ifbb-agent-${p.data.name.replace(/[^\w-]+/g, '_')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importJson(ev) {
    const file = ev.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const list = Array.isArray(obj) ? obj : Array.isArray(obj.profiles) ? obj.profiles : [obj];
        let count = 0;
        list.forEach(item => {
          if (!item || !item.data || !item.data.name) return;
          const errs = ENGINE.validateProfile(item.data);
          if (errs.length) return;
          state.profiles.push({ id: uid(), createdAt: item.createdAt || todayIso(), updatedAt: todayIso(), data: ENGINE.normalizeProfile(item.data), log: Array.isArray(item.log) ? item.log : [] });
          count++;
        });
        if (count) { state.activeId = state.profiles[state.profiles.length - 1].id; save(); }
        toast(count ? `${count} perfil(es) importado(s)` : 'El archivo no contiene perfiles válidos');
        render();
      } catch (e) { toast('Archivo JSON no válido'); }
    };
    reader.readAsText(file);
  }

  function platesCheckboxes(unit, selected) {
    const canon = unit === 'lb' ? KNOWLEDGE.PLATES_LB : KNOWLEDGE.PLATES_KG;
    const sel = Array.isArray(selected) && selected.length ? selected.map(Number) : canon;
    return canon.map(p => `<label style="display:flex;align-items:center;gap:.4rem;margin:.2rem 0;font-size:.85rem;color:var(--tiza)"><input type="checkbox" name="availablePlates" value="${p}" style="width:auto" ${sel.includes(p) ? 'checked' : ''}> ${n1(p)} ${unit}</label>`).join('');
  }

  /* DEC-009: una fila por zona de lesión, con el diagnóstico y el dolor
   * actual ocultos hasta marcar la zona (JS, puramente visual: lo que
   * decide qué cuenta es normalizeHealth en engine.js). */
  function injuryZoneRow(zone, label, inj) {
    const checked = !!inj;
    // Nota: no usar `hidden` + estilo inline `display` en el mismo
    // elemento. El estilo inline siempre le gana a la regla [hidden] de
    // la hoja del navegador, así que quedaría visible igual. El propio
    // display inline (none/flex) es lo único que hace falta.
    return `<div class="injury-zone" data-zone="${zone}">
      <label style="display:flex;align-items:center;gap:.5rem;margin:.25rem 0"><input type="checkbox" name="injuryZones" value="${zone}" class="injury-toggle" style="width:auto" ${checked ? 'checked' : ''}> ${esc(label)}</label>
      <div class="injury-sub" style="padding-left:1.7rem;display:${checked ? 'flex' : 'none'};gap:1.1rem;flex-wrap:wrap;margin:0 0 .6rem">
        <label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--acero)"><input type="checkbox" name="injuryDiagnosed" value="${zone}" style="width:auto" ${inj && inj.diagnosed ? 'checked' : ''}> Diagnóstico profesional</label>
        <label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--acero)"><input type="checkbox" name="injuryPainNow" value="${zone}" style="width:auto" ${inj && inj.painNow ? 'checked' : ''}> Dolor actualmente</label>
        ${inj && inj.clearanceDate ? `<span style="font-size:.78rem;color:var(--acero)">Autorización profesional registrada el ${esc(inj.clearanceDate)}</span>` : ''}
      </div>
    </div>`;
  }

  /* ---------- Datos ---------- */
  function renderData() {
    const editing = ui.editingId ? state.profiles.find(p => p.id === ui.editingId) : null;
    const d = editing ? editing.data : { sex: 'M', activity: 'moderate', level: 'intermediate', daysPerWeek: 4, goal: 'cut', division: 'classic_m' };
    const opt = (list, val, fmt) => list.map(x => `<option value="${esc(fmt ? fmt(x).v : x.id)}" ${(fmt ? fmt(x).v : x.id) === val ? 'selected' : ''}>${esc(fmt ? fmt(x).l : x.label)}</option>`).join('');
    const divisions = Object.values(KNOWLEDGE.DIVISIONS);
    // DEC-009: estructura por defecto si el perfil todavía no tiene datos de salud.
    const h = Object.assign({ screening: {}, diabetes: { type: 'none' }, injuries: [] }, d.health || {});
    h.screening = h.screening || {};
    const injuriesByZone = {};
    (h.injuries || []).forEach(inj => { injuriesByZone[inj.zone] = inj; });
    const hasHealthData = !!(h.screening.regularExercise || h.screening.cvMetabolicRenal || h.screening.symptoms || h.screening.medicalClearance || h.diabetes.type !== 'none' || h.diabetes.medication || (h.injuries || []).length);

    view.innerHTML = `
      <form id="form" novalidate>
        <div class="card accent">
          <h2>${editing ? 'Editar datos' : 'Nuevo perfil'}</h2>
          <p class="muted">Cuantos más datos reales aportes, más preciso será el plan. Los campos con * son obligatorios.</p>
        </div>
        <fieldset>
          <legend>Persona</legend>
          <label>Nombre del perfil *</label>
          <input name="name" value="${esc(d.name || '')}" placeholder="Ej. Óscar · Prep 2027" required>
          <div class="row3">
            <div><label>Sexo *</label><select name="sex" id="sex"><option value="M" ${d.sex === 'M' ? 'selected' : ''}>Hombre</option><option value="F" ${d.sex === 'F' ? 'selected' : ''}>Mujer</option></select></div>
            <div><label>Edad *</label><input name="age" type="number" inputmode="numeric" min="14" max="90" value="${esc(d.age || '')}"></div>
            <div><label>Estatura (cm) *</label><input name="heightCm" type="number" inputmode="decimal" step="0.5" value="${esc(d.heightCm || '')}"></div>
          </div>
          <div class="row2">
            <div><label>Peso (kg) *</label><input name="weightKg" type="number" inputmode="decimal" step="0.1" value="${esc(d.weightKg || '')}"></div>
            <div><label>% grasa medido (si lo sabes)</label><input name="bodyFatPct" type="number" inputmode="decimal" step="0.1" value="${esc(d.bodyFatPct || '')}" placeholder="DXA, plicometría…"></div>
          </div>
          <p class="help">Si no tienes % de grasa medido, rellena las circunferencias y se estimará con el método de la US Navy (±3-4 %).</p>
          <div class="row3">
            <div><label>Cuello (cm)</label><input name="neckCm" type="number" inputmode="decimal" step="0.5" value="${esc(d.neckCm || '')}"></div>
            <div><label>Cintura (cm)</label><input name="waistCm" type="number" inputmode="decimal" step="0.5" value="${esc(d.waistCm || '')}"></div>
            <div><label>Cadera (cm)</label><input name="hipCm" type="number" inputmode="decimal" step="0.5" value="${esc(d.hipCm || '')}" placeholder="mujeres"></div>
          </div>
          <p class="help">Cintura: a la altura del ombligo (hombres) o en el punto más estrecho (mujeres). Cuello: justo bajo la laringe. Cadera: en el punto más ancho.</p>
        </fieldset>
        <fieldset>
          <legend>Actividad y experiencia</legend>
          <label>Actividad diaria *</label>
          <select name="activity">${opt(KNOWLEDGE.ACTIVITY, d.activity)}</select>
          <label>Experiencia en entrenamiento de fuerza *</label>
          <select name="level">
            <option value="novice" ${d.level === 'novice' ? 'selected' : ''}>Principiante (&lt; 1 año seguido)</option>
            <option value="intermediate" ${d.level === 'intermediate' ? 'selected' : ''}>Intermedio (1-4 años)</option>
            <option value="advanced" ${d.level === 'advanced' ? 'selected' : ''}>Avanzado (&gt; 4 años o competidor)</option>
          </select>
          <label>Días de entrenamiento por semana *</label>
          <select name="daysPerWeek">${[3, 4, 5, 6].map(n => `<option value="${n}" ${Number(d.daysPerWeek) === n ? 'selected' : ''}>${n} días</option>`).join('')}</select>
          <label>Grupos musculares rezagados (opcional)</label>
          <p class="help">Reciben un 25 % más de series que el resto, por encima incluso del recorte que les tocaría por tu división.</p>
          <div class="row3">${Object.entries(KNOWLEDGE.MUSCLE_LABELS).map(([id, label]) => `<label style="display:flex;align-items:center;gap:.4rem;margin:.2rem 0;font-size:.85rem;color:var(--tiza)"><input type="checkbox" name="laggingMuscles" value="${id}" style="width:auto" ${(d.laggingMuscles || []).includes(id) ? 'checked' : ''}> ${esc(label)}</label>`).join('')}</div>
        </fieldset>
        <fieldset>
          <legend>Objetivo</legend>
          <label>División IFBB Pro League *</label>
          <select name="division" id="division">${opt(divisions.filter(x => x.sex === d.sex), d.division)}</select>
          <p class="help" id="division-help"></p>
          <label>Fase *</label>
          <select name="goal">
            <option value="cut" ${d.goal === 'cut' ? 'selected' : ''}>Definición / preparación (perder grasa)</option>
            <option value="bulk" ${d.goal === 'bulk' ? 'selected' : ''}>Volumen / off-season (ganar músculo)</option>
            <option value="maintain" ${d.goal === 'maintain' ? 'selected' : ''}>Mantenimiento / recomposición</option>
          </select>
          <div class="row2">
            <div><label>Fecha objetivo (opcional)</label><input name="targetDate" type="date" value="${esc(d.targetDate || '')}"></div>
            <div><label>% grasa objetivo (opcional)</label><input name="targetBf" type="number" inputmode="decimal" step="0.5" value="${esc(d.targetBf || '')}" placeholder="auto según división"></div>
          </div>
          <div id="classic-wrap" ${d.division === 'classic_m' ? '' : 'hidden'}>
            <label>Límite oficial Classic Physique para tu estatura (lb, opcional)</label>
            <input name="classicLimitLb" type="number" inputmode="numeric" value="${esc(d.classicLimitLb || '')}" placeholder="Deja vacío para usar la tabla orientativa">
            <p class="help">La tabla incluida es la de agosto de 2023 y no pudo verificarse contra el reglamento vigente. Si conoces el límite actual, escríbelo aquí.</p>
          </div>
          <label style="display:flex;align-items:center;gap:.5rem;margin-top:1rem"><input type="checkbox" name="healthGoal" style="width:auto" ${d.healthGoal ? 'checked' : ''}> Priorizar salud/funcional sobre estética</label>
          <p class="help">En definición, mantiene el cardio en 150 min/semana en vez de recortarlo, y suma sentadilla búlgara, step-up con carga y paseo del granjero a la rutina de pierna.</p>
        </fieldset>
        <fieldset>
          <legend>Barra cargada</legend>
          <p class="help">Para que el modo sesión te muestre qué discos poner en cada lado, en los ejercicios de barra (sentadilla, press banca, press militar, peso muerto rumano, remo con barra, hip thrust).</p>
          <div class="row2">
            <div><label>Unidad</label><select name="plateUnit" id="plateUnit"><option value="kg" ${(d.plateUnit || 'kg') === 'kg' ? 'selected' : ''}>Kilogramos</option><option value="lb" ${d.plateUnit === 'lb' ? 'selected' : ''}>Libras</option></select></div>
            <div><label>Peso de la barra</label><input name="barWeight" id="barWeight" type="number" inputmode="decimal" step="0.5" value="${esc(d.barWeight || '')}" placeholder="${(d.plateUnit || 'kg') === 'lb' ? '45' : '20'}"></div>
          </div>
          <label>Discos disponibles</label>
          <div class="row3" id="plates-wrap">${platesCheckboxes(d.plateUnit || 'kg', d.availablePlates)}</div>
        </fieldset>
        <fieldset>
          <legend>Salud</legend>
          <p class="help">La app NO reemplaza a un médico, fisioterapeuta ni entrenador certificado. El tamizaje y los avisos de diabetes aplican posicionamientos oficiales. Para lesiones la app no adapta la rutina: te pide la autorización de un profesional y solo evita, como precaución (E4), algunos ejercicios de la zona. Una condición sin regla cargada queda registrada y no cambia nada.</p>
          <label style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" name="healthRegularExercise" style="width:auto" ${h.screening.regularExercise ? 'checked' : ''}> Hago ejercicio planificado ≥30 min, 3 días/semana, desde hace al menos 3 meses</label>
          <label style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" name="healthCvMetabolicRenal" style="width:auto" ${h.screening.cvMetabolicRenal ? 'checked' : ''}> Tengo diagnóstico de enfermedad cardiovascular, metabólica (diabetes) o renal</label>
          <label style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" name="healthSymptoms" style="width:auto" ${h.screening.symptoms ? 'checked' : ''}> Tengo dolor/molestia en el pecho, falta de aire en reposo o con poco esfuerzo, mareo o desmayo, palpitaciones, hinchazón de tobillos, dolor en las piernas al caminar, soplo cardíaco conocido o fatiga inusual</label>
          <label style="display:flex;align-items:center;gap:.5rem;margin-top:.3rem"><input type="checkbox" name="healthMedicalClearance" style="width:auto" ${h.screening.medicalClearance ? 'checked' : ''}> Tengo autorización médica para entrenar a intensidad vigorosa (vigente, últimos 12 meses)</label>
          <p class="help">Si marcaste síntomas, o la condición cardiovascular/metabólica/renal sin entrenar de forma regular, el plan queda oculto hasta marcar esta autorización.</p>

          <label style="margin-top:.8rem">Diabetes</label>
          <select name="diabetesType">
            <option value="none" ${h.diabetes.type === 'none' ? 'selected' : ''}>Ninguna</option>
            <option value="type1" ${h.diabetes.type === 'type1' ? 'selected' : ''}>Tipo 1</option>
            <option value="type2" ${h.diabetes.type === 'type2' ? 'selected' : ''}>Tipo 2</option>
          </select>
          <label style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem"><input type="checkbox" name="healthDiabetesMed" style="width:auto" ${h.diabetes.medication ? 'checked' : ''}> Uso insulina u otro fármaco que baja la glucosa</label>

          <label style="margin-top:.8rem">Lesiones (marcá la zona si tenés una)</label>
          <div id="injury-zones">${KNOWLEDGE.INJURY_ZONES.map(z => injuryZoneRow(z, KNOWLEDGE.INJURY_LABELS[z], injuriesByZone[z])).join('')}</div>
          <p class="help">Con cualquier zona marcada, el plan queda en pausa hasta que confirmes que un profesional te autorizó a entrenar con esa lesión (se pide una vez por zona y se vuelve a pedir si agregás otra). Como precaución (E4) se evitan algunos ejercicios de la zona: no es una adaptación a tu lesión. En Modo sesión podés registrar el dolor de cada serie que la involucre.</p>

          ${hasHealthData ? '<div class="btn-row"><button type="button" class="btn btn-danger" id="btn-clear-health">Borrar datos de salud</button></div>' : ''}
        </fieldset>
        <div id="form-errors"></div>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary btn-block">Guardar y generar plan</button>
        </div>
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-block" id="btn-cancel">Cancelar</button></div>
      </form>`;

    const form = $('#form');
    const sexSel = $('#sex'), divSel = $('#division');
    function refreshDivisions() {
      const sex = sexSel.value;
      const cur = divSel.value;
      divSel.innerHTML = opt(divisions.filter(x => x.sex === sex), KNOWLEDGE.DIVISIONS[cur] && KNOWLEDGE.DIVISIONS[cur].sex === sex ? cur : (sex === 'M' ? 'classic_m' : 'bikini_w'));
      refreshHelp();
    }
    function refreshHelp() {
      const dv = KNOWLEDGE.DIVISIONS[divSel.value];
      $('#division-help').textContent = dv ? `${dv.judging} Grasa en tarima estimada: ${dv.stageBf[0]}-${dv.stageBf[1]} %.` : '';
      $('#classic-wrap').hidden = divSel.value !== 'classic_m';
    }
    sexSel.onchange = refreshDivisions; divSel.onchange = refreshHelp; refreshHelp();
    $('#btn-cancel').onclick = () => go(active() ? 'plan' : 'profiles');
    $('#plateUnit').onchange = () => {
      const u = $('#plateUnit').value;
      $('#barWeight').placeholder = u === 'lb' ? '45' : '20';
      $('#plates-wrap').innerHTML = platesCheckboxes(u, null);
    };
    view.querySelectorAll('.injury-toggle').forEach(cb => cb.onchange = () => {
      const sub = cb.closest('.injury-zone').querySelector('.injury-sub');
      sub.style.display = cb.checked ? 'flex' : 'none';
    });
    const btnClearHealth = $('#btn-clear-health');
    if (btnClearHealth) btnClearHealth.onclick = () => {
      if (!confirm('¿Borrar todos los datos de salud de este perfil? No afecta el resto de los datos.')) return;
      editing.data.health = { screening: { regularExercise: false, cvMetabolicRenal: false, symptoms: false, medicalClearance: false }, diabetes: { type: 'none', medication: false }, injuries: [] };
      editing.updatedAt = todayIso(); save(); toast('Datos de salud borrados'); renderData();
    };

    form.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.laggingMuscles = fd.getAll('laggingMuscles');
      data.availablePlates = fd.getAll('availablePlates');
      data.injuryZones = fd.getAll('injuryZones');
      data.injuryDiagnosed = fd.getAll('injuryDiagnosed');
      data.injuryPainNow = fd.getAll('injuryPainNow');
      const errors = ENGINE.validateProfile(data);
      if (errors.length) { $('#form-errors').innerHTML = errors.map(x => `<div class="alert danger">${esc(x)}</div>`).join(''); window.scrollTo({ top: document.body.scrollHeight }); return; }
      const norm = ENGINE.normalizeProfile(data);
      norm.health = ENGINE.carryOverInjuryClearances(editing && editing.data.health, norm.health); // DEC-011
      if (editing) { editing.data = norm; editing.updatedAt = todayIso(); state.activeId = editing.id; }
      else {
        const p = { id: uid(), createdAt: todayIso(), updatedAt: todayIso(), data: norm, log: [] };
        p.log.push(logEntryFrom(norm));
        state.profiles.push(p); state.activeId = p.id;
      }
      save(); toast('Perfil guardado'); ui.planTab = 'summary'; go('plan');
    };
  }

  function logEntryFrom(d) {
    return { date: todayIso(), weightKg: d.weightKg, bodyFatPct: d.bodyFatPct || null, waistCm: d.waistCm || null, neckCm: d.neckCm || null, hipCm: d.hipCm || null, notes: 'Datos iniciales' };
  }

  /* ---------- Plan ---------- */
  function renderPlan() {
    const p = active();
    if (!p) { view.innerHTML = `<div class="empty"><div class="big">${icon('barbell')}</div><p>Crea o abre un perfil para ver su plan.</p><button class="btn btn-primary" id="e-new">Nuevo perfil</button></div>`; $('#e-new').onclick = () => go('data'); return; }
    const plan = ENGINE.buildPlan(p.data, todayIso());
    // DEC-009: si el tamizaje bloquea (síntomas, o condición + sedentarismo,
    // sin autorización médica marcada), no se muestra el plan.
    if (plan.health.blocked) { view.innerHTML = htmlHealthBlock(plan); wireHealthBlock(p); return; }
    const tabs = [['summary', 'Resumen'], ['nutrition', 'Dieta'], ['training', 'Entreno'], ['targets', 'Medidas'], ['supps', 'Suplementos']];
    view.innerHTML = `
      ${plan.health.disclaimer ? `<p class="muted" style="font-size:.78rem">${esc(plan.health.disclaimer)}</p>` : ''}
      <div class="subtabs">${tabs.map(([id, l]) => `<button class="btn ${ui.planTab === id ? 'active' : ''}" data-pt="${id}">${l}</button>`).join('')}</div>
      <div id="plan-body"></div>`;
    view.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { ui.planTab = b.dataset.pt; renderPlan(); });
    const body = $('#plan-body');
    if (ui.planTab === 'summary') { body.innerHTML = htmlSummary(plan, p); wireCounts(body, 'summary:' + p.id); }
    else if (ui.planTab === 'nutrition') body.innerHTML = htmlNutrition(plan);
    else if (ui.planTab === 'training') body.innerHTML = htmlTraining(plan);
    else if (ui.planTab === 'targets') body.innerHTML = htmlTargets(plan);
    else body.innerHTML = htmlSupps(plan);
    const share = $('#btn-share');
    if (share) share.onclick = () => sharePlan(plan);
    if (ui.planTab === 'training') wireTrainingDays(plan, p);
  }

  /* DEC-009: pantalla de bloqueo cuando el tamizaje lo exige. El motor
   * igual calculó el plan completo (buildPlan es puro); acá se decide no
   * mostrarlo hasta que el usuario marque la autorización médica. */
  function htmlHealthBlock(plan) {
    const h = plan.health;
    const screeningBlocked = !!h.blockReason;
    // Mismo patrón para las dos causas de pausa: advertencia → derivación a un
    // profesional → confirmación explícita. Las lesiones piden la confirmación
    // zona por zona (DEC-011).
    const screeningPart = screeningBlocked ? `
        <div class="alert danger">${esc(h.blockReason)}</div>
        <p class="muted">Esto no es un diagnóstico: es el resultado del tamizaje previo al ejercicio (ACSM/Riebe 2015) que completaste en Datos. Si ya consultaste y tenés autorización para entrenar a intensidad vigorosa, marcala para continuar.</p>
        <div class="btn-row"><button class="btn btn-primary" id="btn-medical-clearance">Tengo autorización médica</button></div>` : '';
    const injuryPart = h.injuryBlockReason ? `
        <div class="alert danger">${esc(h.injuryBlockReason)} ${evTag('E4')}</div>
        <p class="muted">Derivación: un médico o fisioterapeuta puede decirte si podés entrenar y cómo. La app no reemplaza esa valoración.</p>
        ${h.injuryClearance.pendingZones.map(z => `
        <div class="card" style="margin:.5rem 0">
          <strong>${esc(KNOWLEDGE.INJURY_LABELS[z] || z)}</strong>
          <p class="muted" style="margin:.3rem 0">¿Un profesional te autorizó a entrenar con esta lesión? Se guarda con la fecha de hoy.</p>
          <button class="btn btn-primary" data-injury-clearance="${esc(z)}">Sí, un profesional me autorizó</button>
        </div>`).join('')}` : '';
    return `
      <div class="card accent" style="border-color:var(--peligro)">
        <h2>Plan en pausa</h2>
        ${screeningPart}
        ${injuryPart}
        <div class="btn-row"><button class="btn" id="btn-edit-health">Revisar mis respuestas</button></div>
      </div>`;
  }
  function wireHealthBlock(profile) {
    const med = $('#btn-medical-clearance');
    if (med) med.onclick = () => {
      profile.data.health = profile.data.health || { screening: {}, diabetes: { type: 'none' }, injuries: [] };
      profile.data.health.screening.medicalClearance = true;
      profile.updatedAt = todayIso(); save(); toast('Autorización registrada'); renderPlan();
    };
    view.querySelectorAll('[data-injury-clearance]').forEach(btn => btn.onclick = () => {
      const inj = ((profile.data.health && profile.data.health.injuries) || []).find(i => i.zone === btn.dataset.injuryClearance);
      if (!inj) return;
      inj.clearanceDate = todayIso();
      profile.updatedAt = todayIso(); save(); toast('Autorización registrada'); renderPlan();
    });
    $('#btn-edit-health').onclick = () => { ui.editingId = profile.id; go('data'); };
  }

  function wireTrainingDays(plan, profile) {
    view.querySelectorAll('[data-toggle-day]').forEach(btn => {
      btn.onclick = () => {
        const bodyEl = document.getElementById('day-body-' + btn.dataset.toggleDay);
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        if (bodyEl) bodyEl.inert = isOpen;
      };
    });
    view.querySelectorAll('[data-start-session]').forEach(btn => {
      btn.onclick = () => startSessionMode(profile, plan, Number(btn.dataset.startSession), false);
    });
    view.querySelectorAll('[data-start-session-short]').forEach(btn => {
      btn.onclick = () => startSessionMode(profile, plan, Number(btn.dataset.startSessionShort), true);
    });
  }

  // DEC-011: etiqueta de nivel de evidencia visible junto a avisos y ejercicios
  // que son precauciones heurísticas.
  function evTag(level) { return `<span class="ev-tag">${esc(level)} · heurística</span>`; }
  function alerts(list) { return list.map(w => `<div class="alert ${w.level}">${esc(w.text)}${w.evidence ? ' ' + evTag(w.evidence) : ''}</div>`).join(''); }

  function htmlSummary(plan, profile) {
    const m = plan.metrics, t = plan.targets, n = plan.nutrition, tr = plan.training;
    const goalLabel = { cut: 'Definición', bulk: 'Volumen', maintain: 'Mantenimiento' }[plan.input.goal];
    return `
      <div class="card accent">
        <h2>${esc(plan.input.name)}</h2>
        <p class="muted">${esc(t.division.label)} · ${goalLabel} · generado ${fmtDate(plan.generatedAt)}</p>
        ${alerts(plan.warnings)}
        <div class="grid">
          <div class="stat"><div class="v">${statCount(n.calories, 0)}</div><div class="l">kcal/día (${esc(n.deltaLabel)})</div></div>
          <div class="stat"><div class="v">${statCount(n.protein, 0, ' g')}</div><div class="l">proteína</div></div>
          <div class="stat"><div class="v">${statCount(n.carbs, 0, ' g')}</div><div class="l">carbohidratos</div></div>
          <div class="stat"><div class="v">${statCount(n.fat, 0, ' g')}</div><div class="l">grasas</div></div>
          <div class="stat"><div class="v">${statCount(m.bodyFat, 1, ' %')}</div><div class="l">grasa actual</div><div class="s">${esc(m.bfMethod)}</div></div>
          <div class="stat"><div class="v">${statCount(t.targetBf, 1, ' %')}</div><div class="l">grasa objetivo</div></div>
          <div class="stat"><div class="v">${statCount(t.targetWeight, 1, ' kg')}</div><div class="l">peso objetivo</div><div class="s">${t.delta >= 0 ? '+' : ''}${n1(t.delta)} kg</div></div>
          <div class="stat"><div class="v">${plan.input.goal === 'maintain' ? '—' : statCount(t.weeksNeeded, 0, ' sem')}</div><div class="l">duración estimada</div><div class="s">${plan.input.goal === 'maintain' ? '' : 'hasta ' + fmtDate(t.estimatedDate)}</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Cómo se calculó</h3>
        <ul>
          <li>Gasto en reposo: <b>${n0(m.bmr)} kcal</b> (${m.bmrMethod === 'KATCH' ? 'Katch-McArdle sobre masa magra' : 'Mifflin-St Jeor'}) ${cite(m.bmrMethod)}. Mifflin: ${n0(m.bmrMifflin)} · Katch: ${n0(m.bmrKatch)}.</li>
          <li>Gasto total: ${n0(m.bmr)} × ${m.activityFactor} (${esc(m.activityLabel)}) = <b>${n0(m.tdee)} kcal</b>.</li>
          <li>${plan.input.goal === 'cut' ? `Ritmo de pérdida ${t.ratePct} % del peso/semana (${n1(t.rateKg * 1000)} g) → déficit ${n0(-n.delta)} kcal/día ${cite('HELMS_NUT')}.` : plan.input.goal === 'bulk' ? `Superávit ${n0(n.delta)} kcal/día para ganar ~${t.ratePct} % del peso/semana ${cite('IRAKI')}.` : 'Calorías de mantenimiento; la recomposición depende de proteína alta y entrenamiento progresivo.'}</li>
          <li>Masa magra ${n1(m.lbm)} kg · masa grasa ${n1(m.fatMass)} kg · FFMI normalizado ${n1(m.ffmiNormalized)} ${cite('KOURI')}.</li>
          <li>Entrenamiento: ${esc(tr.splitName)}, ${tr.daysPerWeek} días, cada músculo ≥2×/semana ${cite(['SCHOENFELD_FREQ', 'SCHOENFELD_VOL'])}.</li>
        </ul>
        <div class="btn-row"><button class="btn" id="btn-share">Compartir / copiar resumen</button></div>
      </div>
      <p class="muted" style="font-size:.78rem">${esc(plan.disclaimer)}</p>`;
  }

  function htmlNutrition(plan) {
    const n = plan.nutrition, p = plan.input;
    const total = n.protein * 4 + n.carbs * 4 + n.fat * 9;
    const pct = v => Math.round(v / total * 100);
    return `
      <div class="card accent">
        <h2>Dieta diaria</h2>
        ${alerts(n.warnings)}
        <div class="grid">
          <div class="stat"><div class="v">${n0(n.calories)}</div><div class="l">kcal/día</div><div class="s">gasto ${n0(n.tdee)} · ${esc(n.deltaLabel)} ${n.delta >= 0 ? '+' : ''}${n0(n.delta)}</div></div>
          <div class="stat"><div class="v">${n.protein} g</div><div class="l">proteína · ${n.proteinPerKg} g/kg</div><div class="s">${esc(n.proteinRule)}</div></div>
          <div class="stat"><div class="v">${n.carbs} g</div><div class="l">carbohidratos · ${n.carbsPerKg} g/kg</div><div class="s">resto de calorías</div></div>
          <div class="stat"><div class="v">${n.fat} g</div><div class="l">grasas · ${n.fatPct} % kcal</div><div class="s">rango 15-30 %</div></div>
          <div class="stat"><div class="v">${n.fiber} g</div><div class="l">fibra</div><div class="s">14 g / 1.000 kcal</div></div>
          <div class="stat"><div class="v">≥ ${n.waterL} L</div><div class="l">agua</div><div class="s">+ lo perdido por sudor</div></div>
        </div>
        <div class="macro-bar"><span class="p" style="width:${pct(n.protein * 4)}%"></span><span class="c" style="width:${pct(n.carbs * 4)}%"></span><span class="f" style="width:${pct(n.fat * 9)}%"></span></div>
        <div class="legend"><span><i style="background:var(--macro-proteina)"></i>Proteína ${pct(n.protein * 4)} %</span><span><i style="background:var(--macro-carbohidrato)"></i>Carbohidrato ${pct(n.carbs * 4)} %</span><span><i style="background:var(--macro-grasa)"></i>Grasa ${pct(n.fat * 9)} %</span></div>
        <div class="src">Fuentes: ${cite(n.sources)}</div>
      </div>
      <div class="card">
        <h3>Reparto y horario</h3>
        <ul>${n.timing.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <table><tr><th>Comida</th><th class="num">Proteína</th><th class="num">Carbohidrato</th><th class="num">Grasa</th></tr>
        ${mealTable(n, p).map(r => `<tr><td>${esc(r.name)}</td><td class="num">${r.p} g</td><td class="num">${r.c} g</td><td class="num">${r.f} g</td></tr>`).join('')}
        </table>
        <p class="help">Reparto orientativo: la proteína uniforme (0,4-0,55 g/kg por comida) es lo que tiene respaldo; el reparto de carbohidrato y grasa es flexible.</p>
      </div>
      <div class="card">
        <h3>Con qué alimentos cubrirlo</h3>
        <b>Proteína</b><ul>${n.foodGuide.protein.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <b>Carbohidratos</b><ul>${n.foodGuide.carbs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <b>Grasas</b><ul>${n.foodGuide.fat.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3>Cómo ajustar cada semana</h3>
        <ul>
          <li>Pésate en ayunas 3-4 días/semana y usa el promedio semanal, no un día suelto.</li>
          <li>${p.goal === 'cut' ? `Objetivo: −${n1(plan.targets.rateKg * 1000)} g/semana. Si durante 2 semanas pierdes menos de la mitad, resta 100-150 kcal (primero de carbohidrato) o añade 10 min de cardio por sesión.` : p.goal === 'bulk' ? `Objetivo: +${n1(plan.targets.rateKg * 1000)} g/semana. Si ganas más del doble, resta 100-150 kcal; si no ganas en 2 semanas, suma 100-150 kcal de carbohidrato.` : 'Si el peso se desvía más de 1 % en 2 semanas, ajusta ±100-150 kcal.'}</li>
          <li>Mantén la proteína fija; ajusta calorías con carbohidrato y, en segundo lugar, grasa.</li>
          <li>Mide cintura cada 2 semanas en el apartado Progreso: si baja el peso pero no la cintura, revisa la precisión de la dieta.</li>
        </ul>
      </div>`;
  }

  function mealTable(n, p) {
    const pre = p.goal === 'cut' ? 0.35 : 0.3;
    const names = ['Desayuno', 'Comida (pre-entreno)', 'Post-entreno', 'Cena'];
    const cSplit = [0.2, pre, pre, 1 - 0.2 - 2 * pre];
    const fSplit = [0.3, 0.15, 0.15, 0.4];
    return names.map((name, i) => ({ name, p: Math.round(n.protein / 4), c: Math.round(n.carbs * cSplit[i]), f: Math.round(n.fat * fSplit[i]) }));
  }

  function htmlTraining(plan) {
    const tr = plan.training, t = plan.targets;
    const setsRows = Object.entries(tr.weeklySets).map(([mu, s]) => `<tr><td>${esc(KNOWLEDGE.MUSCLE_LABELS[mu])}${tr.laggingApplied[mu] ? ' <span class="cite" title="Grupo rezagado: +25 % de series, anula el énfasis de la división">rezagado</span>' : ''}</td><td class="num">${s}</td></tr>`).join('');
    // "Día actual": lunes = sesión 0, se repite cada semana según los días del split.
    const todayIdx = ((new Date().getDay() + 6) % 7) % tr.daysPerWeek;
    return `
      <div class="card accent">
        <h2>Entrenamiento · ${esc(tr.splitName)}</h2>
        <p class="muted">${tr.daysPerWeek} días/semana · énfasis de la división: ${esc(t.division.emphasis.join(' · '))}</p>
        <ul>
          <li><b>Intensidad:</b> ${esc(tr.intensity)} ${cite(['HELMS_TRAIN', 'ACSM_RT'])}</li>
          <li><b>Progresión:</b> ${esc(tr.progression)} ${cite('ACSM_RT')}</li>
          <li><b>Descarga:</b> ${esc(tr.deload)}</li>
          ${tr.posing ? `<li><b>Posado:</b> ${esc(tr.posing)}</li>` : ''}
        </ul>
        <div class="src">Fuentes: ${cite(tr.sources)}</div>
      </div>
      ${tr.sessions.map((s, i) => htmlSessionCard(s, i, i === todayIdx)).join('')}
      <div class="card">
        <h3>Cardio</h3>
        <p><b>${tr.cardio.sessions} sesiones × ${tr.cardio.minutes} min</b> · ${esc(tr.cardio.type)}</p>
        <p class="muted">${esc(tr.cardio.rule)} ${cite(['HELMS_TRAIN', 'ACSM_CARDIO'])}</p>
      </div>
      <details class="card"><summary>Series semanales por grupo muscular</summary>
        <table><tr><th>Músculo</th><th class="num">Series/semana</th></tr>${setsRows}</table>
        <p class="help">Base: 10 (principiante), 14 (intermedio) o 18 (avanzado) series/semana por grupo grande, ajustadas por división y reducidas un 15 % en definición ${cite(['SCHOENFELD_VOL', 'HELMS_TRAIN'])}.</p>
      </details>
      <div class="card">
        <h3>Reglas de ejecución</h3>
        <ul>
          <li>Calienta con 2-3 series de aproximación en el primer ejercicio de cada grupo muscular.</li>
          <li>Rango completo de movimiento y técnica estable; el peso es la herramienta, no el objetivo.</li>
          <li>Anota cargas y repeticiones cada sesión: sin registro no hay progresión.</li>
          <li>Si acumulas dolor articular, sustituye el ejercicio por otro de la misma lista para ese músculo.</li>
          <li>Duerme 7-9 h: el sueño insuficiente reduce la retención de masa magra en déficit.</li>
        </ul>
      </div>`;
  }

  function htmlExRow(e, extraClass, label, reps, setsLabel, showTag) {
    return `<div class="ex-row ${extraClass}">
      <div class="ex-main">
        <div class="ex-name">${esc(label != null ? label : e.name)}${showTag ? ' <span class="ex-tag">Top set</span>' : ''}${e.injurySubstitute ? ' ' + evTag(e.injurySubstitute.evidence) : ''}</div>
        <div class="ex-fields">
          <span class="f">${esc(e.muscleLabel)}</span>
          <span class="f">${icon('gauge')} RIR ${esc(showTag ? e.topSet.rir : e.rir)}</span>
          <span class="f">${icon('clock')} ${esc(showTag ? '3 min' : e.rest)}</span>
        </div>
      </div>
      <div class="ex-sets">${esc(setsLabel)} × ${esc(reps)}</div>
    </div>`;
  }

  function htmlExercise(e) {
    if (e.topSet) {
      const topRow = htmlExRow(e, 'type-top', e.name, e.topSet.reps, '1', true);
      const backoffRow = e.backoffSets > 0
        ? `<div class="backoff">${htmlExRow(e, e.type === 'compound' ? 'type-compound' : 'type-isolation', 'Back-off (−10 % carga)', e.reps, e.backoffSets, false)}</div>`
        : '';
      return `<div class="ex-group">${topRow}${backoffRow}</div>`;
    }
    return `<div class="ex-group">${htmlExRow(e, e.type === 'compound' ? 'type-compound' : 'type-isolation', e.name, e.reps, e.sets, false)}</div>`;
  }

  function htmlSessionCard(s, i, isToday) {
    const open = isToday;
    // Composición del día por tipo de serie: el top set de cada ejercicio
    // con top set cuenta como 1 (rojo); el resto de sus series (back-off)
    // y las series de los ejercicios sin top set cuentan como azul
    // (multiarticular) o verde (aislamiento) según el tipo del ejercicio.
    const counts = { top: 0, compound: 0, isolation: 0 };
    s.exercises.forEach(e => {
      const rest = e.topSet ? e.sets - 1 : e.sets;
      if (e.topSet) counts.top += 1;
      counts[e.type === 'compound' ? 'compound' : 'isolation'] += rest;
    });
    const pct = n => s.totalSets ? (n / s.totalSets * 100) : 0;
    const muscles = [...new Set(s.exercises.map(e => e.muscleLabel))];
    return `<div class="session">
      <button type="button" class="session-head" data-toggle-day="${i}" aria-expanded="${open}" aria-controls="day-body-${i}">
        <div class="session-head-main">
          <h4>${esc(s.name)}${isToday ? ' <span class="day-tag">hoy</span>' : ''}</h4>
          <div class="session-metrics">
            <span class="metric"><b>${s.totalSets}</b> series</span>
            <span class="metric">${icon('clock')} ~${s.durationMin} min</span>
          </div>
          <div class="session-bar" aria-hidden="true">
            <span class="top" style="width:${pct(counts.top)}%"></span>
            <span class="compound" style="width:${pct(counts.compound)}%"></span>
            <span class="isolation" style="width:${pct(counts.isolation)}%"></span>
          </div>
          <div class="session-muscles">${muscles.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
        </div>
        ${icon('chevron', 'chev')}
      </button>
      <div class="session-body" id="day-body-${i}" ${open ? '' : 'inert'}>
        <div class="session-body-inner">
          <div class="ex-list">${s.exercises.map(htmlExercise).join('')}</div>
          <div class="btn-row" style="margin-top:.6rem">
            <button class="btn btn-primary btn-lg" data-start-session="${i}" style="flex:2">Empezar sesión</button>
            <button class="btn" data-start-session-short="${i}" style="flex:1">Versión corta</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function htmlTargets(plan) {
    const m = plan.metrics, t = plan.targets, p = plan.input;
    const cl = t.classic;
    const whtr = m.whtr;
    return `
      <div class="card accent">
        <h2>Medidas objetivo</h2>
        ${alerts(t.warnings)}
        <table>
          <tr><th>Medida</th><th class="num">Actual</th><th class="num">Objetivo</th></tr>
          <tr><td>Peso</td><td class="num">${n1(p.weightKg)} kg</td><td class="num">${n1(t.targetWeight)} kg</td></tr>
          <tr><td>% grasa corporal</td><td class="num">${n1(m.bodyFat)} %</td><td class="num">${n1(t.targetBf)} %</td></tr>
          <tr><td>Masa grasa</td><td class="num">${n1(m.fatMass)} kg</td><td class="num">${n1(t.targetFatMass)} kg</td></tr>
          <tr><td>Masa magra</td><td class="num">${n1(m.lbm)} kg</td><td class="num">${p.goal === 'bulk' ? '↑ ' : ''}${n1(t.targetLbm)} kg${p.goal === 'cut' ? ' (conservar)' : ''}</td></tr>
          <tr><td>Cintura</td><td class="num">${p.waistCm ? n1(p.waistCm) + ' cm' : '—'}</td><td class="num">&lt; ${n0(t.waistMaxHealth)} cm (salud)</td></tr>
          <tr><td>IMC</td><td class="num">${n1(m.bmi)}</td><td class="num">${n1(t.targetWeight / Math.pow(p.heightCm / 100, 2))}</td></tr>
          <tr><td>FFMI normalizado</td><td class="num">${n1(m.ffmiNormalized)}</td><td class="num">≤ 25 natural</td></tr>
        </table>
        <div class="src">Grasa en tarima por división: estimación a partir de estudios de caso con DXA ${cite('ROSSOW')} y criterios de juicio ${cite('IFBB_RULES')}. Grasa esencial mínima ${cite('ACE_BF')}. Cintura/estatura ${cite('ASHWELL')}. FFMI ${cite('KOURI')}.</div>
      </div>
      ${cl ? `<div class="card">
        <h3>Classic Physique · límite de peso</h3>
        <p>Estatura ${n1(p.heightCm)} cm → límite <b>${cl.lb} lb (${n1(cl.kg)} kg)</b> <span class="muted">(${esc(cl.source)})</span>.</p>
        <p>Peso objetivo ${n1(t.targetWeight)} kg: ${cl.status === 'ok' ? `<b style="color:var(--exito)">dentro del límite</b> con ${n1(cl.marginKg)} kg de margen.` : `<b style="color:var(--peligro)">supera el límite</b> en ${n1(-cl.marginKg)} kg.`}</p>
        <p class="help">La tabla de la app es la de agosto de 2023 y hubo cambios para 2025. Confirma el límite en el reglamento vigente de la IFBB Pro League e introdúcelo en Datos si difiere.</p>
      </div>` : ''}
      <div class="card">
        <h3>Calendario</h3>
        ${p.goal === 'maintain' ? '<p>Fase de mantenimiento: reevalúa medidas cada 4 semanas.</p>' : `
        <ul>
          <li>Ritmo: ${t.ratePct} % del peso/semana (${n1(t.rateKg * 1000)} g/semana).</li>
          <li>Duración estimada: <b>${n0(t.weeksNeeded)} semanas</b> → ${fmtDate(t.estimatedDate)}.</li>
          ${p.targetDate ? `<li>Fecha objetivo indicada: ${fmtDate(p.targetDate)} → ${t.dateFeasible === false ? '<b style="color:var(--peligro)">no alcanzable con seguridad</b>' : '<b style="color:var(--exito)">alcanzable</b>'}.</li>` : ''}
          ${p.goal === 'cut' ? '<li>Reserva las últimas 1-2 semanas para ajustes finales (peak week) con supervisión: la evidencia sobre manipulación de agua y sodio es limitada y arriesgada.</li><li>Tras la competición, planifica 4-8 semanas de subida gradual de calorías ("reverse diet") para recuperar función hormonal.</li>' : '<li>Cuando alcances el techo de grasa off-season, pasa a una minidefinición de 4-8 semanas antes de seguir en volumen.</li>'}
        </ul>`}
      </div>
      ${whtr ? `<div class="card"><h3>Salud</h3><p>Cintura/estatura actual: <b>${n1(whtr * 100) / 100}</b> (umbral de riesgo: 0,5).</p></div>` : ''}`;
  }

  function htmlSupps(plan) {
    return `
      <div class="card accent">
        <h2>Suplementos con respaldo</h2>
        <p class="muted">Solo se listan los que cuentan con posicionamiento oficial de la International Society of Sports Nutrition o evidencia de revisión. Ninguno es obligatorio; la comida y el descanso pesan mucho más.</p>
        ${plan.supplements.map(s => `<div class="session"><h4>${esc(s.name)} <small>${cite(s.source)}</small></h4><p><b>${esc(s.dose)}</b></p><p class="muted">${esc(s.note)}</p></div>`).join('')}
      </div>
      <div class="card">
        <h3>Qué no incluye este plan y por qué</h3>
        <ul>
          <li>Quemagrasas, "boosters" hormonales, BCAA aislados o glutamina: sin efecto demostrado en atletas que ya cubren su proteína.</li>
          <li>Fármacos y esteroides anabolizantes: fuera del alcance de la app; el FFMI de referencia (≤25) corresponde a atletas naturales.</li>
          <li>Protocolos extremos de deshidratación en la semana final: riesgo cardiovascular documentado sin beneficio consistente.</li>
        </ul>
      </div>`;
  }

  function sharePlan(plan) {
    const n = plan.nutrition, t = plan.targets;
    const text = `Training Agent · ${plan.input.name}\n${t.division.label} · ${plan.input.goal}\n` +
      `Calorías: ${n.calories} kcal (P ${n.protein} g · C ${n.carbs} g · G ${n.fat} g)\n` +
      `Grasa ${Math.round(plan.metrics.bodyFat * 10) / 10} % → ${t.targetBf} % · Peso ${plan.input.weightKg} → ${Math.round(t.targetWeight * 10) / 10} kg en ~${Math.round(t.weeksNeeded)} semanas\n` +
      `Entreno: ${plan.training.splitName}, ${plan.training.daysPerWeek} días/semana`;
    if (navigator.share) navigator.share({ title: 'Plan Training Agent', text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Resumen copiado'));
  }

  /* ---------- Modo sesión (Fase 4) ----------
   * Pantalla a pantalla completa para usar en el gimnasio. No toca
   * plan.training en ningún momento ("Versión corta" es solo una forma
   * distinta de mostrarlo). Cada serie registrada se guarda al toque en
   * profile.workouts (mismo localStorage que usa Progreso). */
  let sm = null; // estado del modo sesión activo (o null si no hay ninguno)
  let smWakeLock = null;
  let smTimerInterval = null;
  let smTimerState = null;

  function parseRestSeconds(label) {
    const m = String(label || '').match(/(\d+)/);
    const n = m ? parseInt(m[1], 10) : 90;
    return /min/.test(label || '') ? n * 60 : n;
  }
  function fmtTimer(s) { const m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

  /* ---------- Barra cargada (Fase 5) ----------
   * Reparto de discos por lado: greedy de mayor a menor denominación entre
   * los discos disponibles del perfil. Si no da exacto, se queda en el
   * valor más cercano POR DEBAJO y se muestra la diferencia. */
  function platesForWeight(totalWeight, barWeight, availablePlates) {
    const perSide = (totalWeight - barWeight) / 2;
    if (!(perSide > 0)) return { plates: [], achieved: barWeight, diff: round2(totalWeight - barWeight) };
    const sorted = availablePlates.slice().sort((a, b) => b - a);
    const used = []; let remaining = perSide;
    sorted.forEach(p => { while (remaining >= p - 1e-6) { used.push(p); remaining -= p; } });
    const achieved = barWeight + used.reduce((a, b) => a + b, 0) * 2;
    return { plates: used, achieved: round2(achieved), diff: round2(totalWeight - achieved) };
  }
  function round2(v) { return Math.round(v * 100) / 100; }

  function svgBarbell(result, unit) {
    const canon = unit === 'lb' ? KNOWLEDGE.PLATES_LB : KNOWLEDGE.PLATES_KG;
    const colorFor = w => { const idx = canon.findIndex(p => Math.abs(p - w) < 1e-6); return KNOWLEDGE.PLATE_COLORS[idx === -1 ? canon.length - 1 : idx]; };
    const heightFor = w => Math.min(64, 24 + w * (unit === 'lb' ? 0.55 : 1.2));
    const widthFor = w => (unit === 'lb' ? w >= 35 : w >= 10) ? 11 : 7;
    let x = 96, i = 0; // arranca pegado al manguito, hacia afuera
    const rects = result.plates.map(w => {
      const h = heightFor(w), wd = widthFor(w);
      const delay = `style="animation-delay:${i * 40}ms"`;
      const svg = `<rect class="plate-rect plate-rect-l" ${delay} x="${x}" y="${(100 - h) / 2}" width="${wd}" height="${h}" rx="2" fill="${colorFor(w)}" stroke="#1a1d20" stroke-width="1"></rect><rect class="plate-rect plate-rect-r" ${delay} x="${292 - x - wd}" y="${(100 - h) / 2}" width="${wd}" height="${h}" rx="2" fill="${colorFor(w)}" stroke="#1a1d20" stroke-width="1"></rect>`;
      x += wd + 1.5; i++;
      return svg;
    }).join('');
    return `<svg class="platebar" viewBox="0 0 292 100" width="100%" height="64" role="img" aria-label="Carga de la barra">
      <rect x="0" y="46" width="292" height="8" rx="2" fill="var(--acero)"></rect>
      <rect x="86" y="30" width="10" height="40" rx="2" fill="var(--superficie-2)" stroke="var(--borde)"></rect>
      <rect x="196" y="30" width="10" height="40" rx="2" fill="var(--superficie-2)" stroke="var(--borde)"></rect>
      ${rects}
    </svg>`;
  }

  /* Fase 7: imagen ilustrativa (posición inicial/final) del ejercicio,
   * solo si hay un equivalente mapeado en EXERCISE_IMAGES. Alterna entre
   * ambas por CSS (sin JS); con prefers-reduced-motion queda fija en la
   * primera. Puramente decorativa/informativa: no participa de ningún
   * cálculo ni se guarda en ningún lado. */
  function htmlExerciseImage(ex) {
    const imgs = typeof EXERCISE_IMAGES !== 'undefined' ? EXERCISE_IMAGES[ex.name] : null;
    if (!imgs) return '';
    return `<div class="sm-image-wrap">
      <img class="sm-image sm-image-a" src="${esc(imgs[0])}" alt="${esc(ex.name)} · posición inicial" loading="lazy" width="140" height="140">
      <img class="sm-image sm-image-b" src="${esc(imgs[1])}" alt="${esc(ex.name)} · posición final" loading="lazy" width="140" height="140">
    </div>`;
  }

  function htmlPlateBarsForExercise(profile, ex, last) {
    if (!KNOWLEDGE.BARBELL_PATTERNS.has(ex.pattern)) return '';
    const hasTop = ex.sets.some(s => s.setType === 'top');
    const findLast = (type, num) => last && last.sets.find(s => s.setType === type && s.setNumber === num);
    if (hasTop) {
      const topW = findLast('top', 1); const boW = findLast('backoff', 1);
      return `<div class="card" id="platebar-top" style="margin-bottom:.8rem"><h3 style="font-size:.85rem;margin-bottom:.3rem">Carga · Top set</h3>${htmlPlateBar(profile, ex.pattern, topW && topW.weight)}</div>` +
        (ex.sets.some(s => s.setType === 'backoff') ? `<div class="card" style="margin-bottom:.8rem"><h3 style="font-size:.85rem;margin-bottom:.3rem">Carga · Back-off</h3>${htmlPlateBar(profile, ex.pattern, boW && boW.weight)}</div>` : '');
    }
    const firstW = findLast('normal', 1);
    return `<div class="card" style="margin-bottom:.8rem"><h3 style="font-size:.85rem;margin-bottom:.3rem">Carga sugerida</h3>${htmlPlateBar(profile, ex.pattern, firstW && firstW.weight)}</div>`;
  }

  function htmlPlateBar(profile, pattern, weight) {
    if (!KNOWLEDGE.BARBELL_PATTERNS.has(pattern)) return '';
    if (!weight || weight <= 0) return `<div class="platebar-wrap"><p class="platebar-note">Registrá tu primera sesión para ver la carga.</p></div>`;
    const unit = profile.data.plateUnit || 'kg';
    const bar = profile.data.barWeight || (unit === 'lb' ? 45 : 20);
    const plates = profile.data.availablePlates && profile.data.availablePlates.length ? profile.data.availablePlates : (unit === 'lb' ? KNOWLEDGE.PLATES_LB : KNOWLEDGE.PLATES_KG);
    const res = platesForWeight(weight, bar, plates);
    const exact = Math.abs(res.diff) < 0.01;
    return `<div class="platebar-wrap">
      ${svgBarbell(res, unit)}
      <div class="platebar-weight">${n1(exact ? weight : res.achieved)} ${unit}${!exact ? ` <span class="muted" style="font-size:.8rem">(objetivo ${n1(weight)} ${unit}, −${n1(Math.abs(res.diff))} ${unit})</span>` : ''}</div>
      <div class="platebar-note">barra ${n1(bar)} ${unit} + ${res.plates.length ? res.plates.map(p => n1(p)).join(' + ') + ' por lado' : 'sin discos'}</div>
    </div>`;
  }

  // Misma fórmula que usa engine.js para la duración estimada (DEC-003 v2 /
  // DEC-007), aplicada acá solo para mostrar el total de la versión corta;
  // no cambia ningún cálculo del plan.
  function exerciseDurationMin(e) {
    const uf = e.unilateral ? 2 : 1;
    const exec = KNOWLEDGE.VALIDATOR_RULES.setExecutionSeconds.value; // DEC-010
    let seconds = 0;
    if (e.topSet) { seconds += uf * (180 + exec); seconds += uf * ((e.backoffSets || 0) * (150 + exec)); }
    else { const rest = e.type === 'compound' ? 150 : 75; seconds += uf * (e.sets * (rest + exec)); }
    return Math.round(seconds / 60);
  }

  // DEC-009 · Capa 3: ¿este grupo muscular queda involucrado por alguna de
  // las zonas de lesión declaradas? (tenga o no diagnóstico). Más amplio
  // que "el patrón excluido": un ejercicio que YA es el sustituto (porque
  // el excluido ni siquiera llega a aparecer en el plan) sigue
  // involucrando la zona y por eso también lleva escala de dolor.
  function injuryAffectsMuscle(muscle, zones) {
    return zones.some(z => KNOWLEDGE.INJURY_EXCLUSIONS[z] && KNOWLEDGE.INJURY_EXCLUSIONS[z][muscle]);
  }
  // Alternativa dentro del mismo grupo muscular para un ejercicio marcado
  // por dolor: el siguiente de la lista del catálogo que no esté excluido
  // por las zonas declaradas ni sea el propio ejercicio marcado.
  function findPainSubstitute(pattern, bucket, zones, profile) {
    const lib = KNOWLEDGE.EXERCISES[bucket] || [];
    const excluded = new Set([pattern]);
    zones.forEach(z => { const map = KNOWLEDGE.INJURY_EXCLUSIONS[z]; if (map && map[bucket]) map[bucket].forEach(p => excluded.add(p)); });
    const flags = (profile.painFlags || {});
    return lib.find(ex => !excluded.has(ex.pattern) && !(flags[ex.pattern] && flags[ex.pattern].flagged) && (!ex.injuryOnly || zones.indexOf(ex.injuryOnly) !== -1));
  }

  function buildSmExercises(session, short, profile) {
    let list = session.exercises;
    if (short) list = list.filter(e => e.type === 'compound').slice(0, 2);
    const zones = ((profile.data.health && profile.data.health.injuries) || []).map(i => i.zone);
    const flags = profile.painFlags || {};
    return list.map(e => {
      let ex = e, substitutedFrom = null;
      const flag = flags[e.pattern];
      if (flag && flag.flagged) {
        // DEC-010: la lista de sustitutos sale del bucket donde vive el
        // ejercicio; el sustituto trae su propia identidad y aporte.
        const alt = findPainSubstitute(e.pattern, e.bucket, zones, profile);
        if (alt) { substitutedFrom = e.name; ex = Object.assign({}, e, ENGINE.exerciseFields(alt, e.bucket), { name: alt.name, pattern: alt.pattern, reps: `${alt.reps[0]}-${alt.reps[1]}`, topSet: null, backoffSets: 0, injurySubstitute: alt.injuryOnly ? { zone: alt.injuryOnly, evidence: 'E4' } : null }); }
      }
      // DEC-011 (E4): dolor por encima del umbral en 2+ sesiones distintas de
      // las últimas 4 semanas en el patrón ORIGINAL del plan (aunque haya sido
      // sustituido) → recomendar consultar a un profesional.
      const painAdvice = ENGINE.painProfessionalAdvice(flags[e.pattern], todayIso());
      const sets = [];
      if (ex.topSet) {
        sets.push({ setType: 'top', setNumber: 1, repsLabel: ex.topSet.reps, restLabel: '3 min' });
        for (let i = 0; i < (ex.backoffSets || 0); i++) sets.push({ setType: 'backoff', setNumber: i + 1, repsLabel: ex.reps, restLabel: ex.rest });
      } else {
        for (let i = 0; i < ex.sets; i++) sets.push({ setType: 'normal', setNumber: i + 1, repsLabel: ex.reps, restLabel: ex.rest });
      }
      return {
        name: ex.name, exerciseId: ex.exerciseId, bucket: ex.bucket, muscle: ex.muscle, muscleLabel: ex.muscleLabel, type: ex.type, pattern: ex.pattern, unilateral: ex.unilateral,
        durationMin: exerciseDurationMin(ex), sets, substitutedFrom,
        painScale: injuryAffectsMuscle(ex.bucket, zones),
        injurySubstitute: ex.injurySubstitute || null,
        painAdvice: painAdvice.advise ? { sessions: painAdvice.sessions, name: e.name } : null,
      };
    });
  }

  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) smWakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* no disponible o denegado: seguimos igual */ }
  }
  function releaseWakeLock() { try { if (smWakeLock) { smWakeLock.release(); smWakeLock = null; } } catch (e) { /* noop */ } }

  function startSessionMode(profile, plan, dayIndex, short) {
    const session = plan.training.sessions[dayIndex];
    const exercises = buildSmExercises(session, short, profile);
    if (!exercises.length) { toast('Este día no tiene multiarticulares para la versión corta.'); return; }
    sm = {
      profileId: profile.id, sessionId: uid(), dayIndex, dayName: session.name, short,
      exercises, exIndex: 0, startedAt: Date.now(), finished: false,
      values: exercises.map(e => e.sets.map(() => ({ weight: '', reps: '', done: false, pain: '' }))),
    };
    requestWakeLock();
    let root = document.getElementById('session-mode-root');
    if (!root) { root = document.createElement('div'); root.id = 'session-mode-root'; document.body.appendChild(root); }
    renderSessionMode(profile);
  }

  function endSessionMode() {
    closeTimer();
    releaseWakeLock();
    const root = document.getElementById('session-mode-root');
    if (root) root.remove();
    sm = null;
  }

  function lastTimeFor(profile, exerciseName) {
    const all = (profile.workouts || []).filter(w => w.exercise === exerciseName && w.sessionId !== sm.sessionId);
    if (!all.length) return null;
    let lastEntry = all[0];
    all.forEach(w => { if (w.savedAt > lastEntry.savedAt) lastEntry = w; });
    const sets = all.filter(w => w.sessionId === lastEntry.sessionId).sort((a, b) => (a.setType === 'top' ? -1 : b.setType === 'top' ? 1 : 0) || a.setNumber - b.setNumber);
    return { date: lastEntry.date, sets };
  }

  function renderSessionMode(profile) {
    const root = document.getElementById('session-mode-root');
    if (!root || !sm) return;
    if (sm.finished) { root.innerHTML = htmlSmSummary(profile); wireSmSummary(profile); return; }
    const ex = sm.exercises[sm.exIndex];
    const vals = sm.values[sm.exIndex];
    const last = lastTimeFor(profile, ex.name);
    const doneCount = sm.values.flat().filter(v => v.done).length;
    const totalCount = sm.values.flat().length;
    root.innerHTML = `
      <div class="session-mode">
        <div class="session-mode-head">
          <button class="btn btn-icon" id="sm-close" aria-label="Cerrar sesión">✕</button>
          <div class="prog">${sm.short ? 'Versión corta · ' : ''}Ejercicio ${sm.exIndex + 1} de ${sm.exercises.length} · ${doneCount}/${totalCount} series</div>
          <button class="btn" id="sm-finish">Terminar</button>
        </div>
        <div class="session-mode-body">
          <h2 class="sm-exname">${esc(ex.name)}</h2>
          <div class="sm-exmeta">${esc(ex.muscleLabel)} ${sm.short ? `· ~${ex.durationMin} min` : ''}</div>
          ${ex.substitutedFrom ? `<div class="alert warn">Reemplaza a "${esc(ex.substitutedFrom)}" por el dolor registrado la vez pasada. Te sugerimos consultar a un profesional. ${evTag('E4')}</div>` : ''}
          ${ex.painAdvice ? `<div class="alert danger">Registraste dolor por encima del umbral en "${esc(ex.painAdvice.name)}" en ${ex.painAdvice.sessions} sesiones distintas de las últimas 4 semanas. Te recomendamos consultar a un profesional antes de seguir cargando ese movimiento. ${evTag('E4')}</div>` : ''}
          ${ex.injurySubstitute ? `<div class="alert info">Ejercicio incluido como precaución por la zona declarada: no es una adaptación a tu lesión. ${evTag('E4')}</div>` : ''}
          ${htmlExerciseImage(ex)}
          ${last ? `<div class="sm-last ${last.sets.some(s => s.setType === 'top') ? 'sm-last-top' : ''}">
            <b>Última vez</b> (${fmtDate(last.date)}): ${last.sets.map(s => `${s.setType === 'top' ? icon('trophy') + ' ' : ''}<span class="v">${n1(s.weight)} ${profile.data.plateUnit || 'kg'} × ${s.reps}</span>`).join(' · ')}
          </div>` : `<div class="sm-last">Primera vez que registrás este ejercicio.</div>`}
          ${htmlPlateBarsForExercise(profile, ex, last)}
          ${ex.sets.map((st, i) => htmlSmSet(st, i, vals[i], profile.data.plateUnit || 'kg', ex.painScale)).join('')}
        </div>
        <div class="session-mode-foot">
          <button class="btn btn-icon" id="sm-prev" ${sm.exIndex === 0 ? 'disabled' : ''} aria-label="Ejercicio anterior">‹</button>
          <button class="btn btn-primary" id="sm-next" style="flex:1">${sm.exIndex === sm.exercises.length - 1 ? 'Finalizar ejercicios' : 'Siguiente ejercicio'}</button>
          <button class="btn btn-icon" id="sm-next-arrow" ${sm.exIndex === sm.exercises.length - 1 ? 'disabled' : ''} aria-label="Ejercicio siguiente">›</button>
        </div>
      </div>`;
    wireSessionMode(profile);
  }

  function htmlSmSet(st, i, v, unit, painScale) {
    const label = { top: 'Top set', backoff: 'Back-off', normal: `Serie ${st.setNumber}` }[st.setType];
    return `<div class="sm-set ${v.done ? 'done' : ''}" data-set="${i}">
      <div class="sm-set-row">
        <div class="idx">${label === `Serie ${st.setNumber}` ? st.setNumber : (st.setType === 'top' ? icon('trophy') : '↓')}</div>
        <div class="fieldwrap"><input type="number" inputmode="decimal" placeholder="${unit}" value="${v.weight || ''}" data-sm-weight="${i}" ${v.done ? 'disabled' : ''}><div class="unit">peso (${unit})</div></div>
        <div class="fieldwrap"><input type="number" inputmode="numeric" placeholder="${st.repsLabel}" value="${v.reps || ''}" data-sm-reps="${i}" ${v.done ? 'disabled' : ''}><div class="unit">reps (obj. ${esc(st.repsLabel)})</div></div>
        <button class="btn ${v.done ? '' : 'btn-primary'} done-btn" data-sm-done="${i}" ${v.done ? 'disabled' : ''}>${v.done ? icon('check', 'check-draw') : 'Hecha'}</button>
      </div>
      ${painScale ? `<div class="fieldwrap sm-pain"><input type="number" inputmode="numeric" min="0" max="10" placeholder="0-10" value="${v.pain === '' || v.pain == null ? '' : v.pain}" data-sm-pain="${i}" ${v.done ? 'disabled' : ''}><div class="unit">dolor en esta serie (0-10)</div></div>` : ''}
    </div>`;
  }

  function wireSessionMode(profile) {
    const root = document.getElementById('session-mode-root');
    $('#sm-close').onclick = () => { if (confirm('¿Salir del modo sesión? Lo ya registrado queda guardado.')) endSessionMode(); };
    $('#sm-finish').onclick = () => { sm.finished = true; renderSessionMode(profile); };
    $('#sm-prev').onclick = () => { sm.exIndex = Math.max(0, sm.exIndex - 1); renderSessionMode(profile); };
    const next = () => {
      if (sm.exIndex < sm.exercises.length - 1) { sm.exIndex++; renderSessionMode(profile); }
      else { sm.finished = true; renderSessionMode(profile); }
    };
    $('#sm-next').onclick = next;
    const nextArrow = $('#sm-next-arrow'); if (nextArrow) nextArrow.onclick = () => { if (sm.exIndex < sm.exercises.length - 1) { sm.exIndex++; renderSessionMode(profile); } };
    root.querySelectorAll('[data-sm-weight]').forEach(inp => inp.oninput = () => { sm.values[sm.exIndex][Number(inp.dataset.smWeight)].weight = inp.value; });
    root.querySelectorAll('[data-sm-reps]').forEach(inp => inp.oninput = () => { sm.values[sm.exIndex][Number(inp.dataset.smReps)].reps = inp.value; });
    root.querySelectorAll('[data-sm-pain]').forEach(inp => inp.oninput = () => { sm.values[sm.exIndex][Number(inp.dataset.smPain)].pain = inp.value; });
    root.querySelectorAll('[data-sm-done]').forEach(btn => btn.onclick = () => smLogSet(profile, Number(btn.dataset.smDone)));
  }

  // DEC-009: marca/desmarca un ejercicio para sustituir según el dolor
  // registrado. Dolor >5 marca (o reconfirma la marca). Dolor ≤5 solo
  // desmarca después de 2 sesiones DISTINTAS seguidas sin pasarse de 5.
  function logPain(profile, pattern, pain) {
    profile.painFlags = profile.painFlags || {};
    // DEC-011: la lógica vive en engine.js (pura y testeada); además de la marca
    // guarda las sesiones con dolor para el aviso de consultar a un profesional.
    profile.painFlags[pattern] = ENGINE.applyPainReading(profile.painFlags[pattern], pain, sm.sessionId, todayIso());
  }

  function smLogSet(profile, setIdx) {
    const ex = sm.exercises[sm.exIndex], st = ex.sets[setIdx], v = sm.values[sm.exIndex][setIdx];
    const reps = parseInt(v.reps, 10);
    if (!reps || reps <= 0) { toast('Poné las repeticiones hechas.'); return; }
    const weight = parseFloat(v.weight) || 0;
    v.weight = weight; v.reps = reps; v.done = true;
    let pain = null;
    if (ex.painScale) { pain = v.pain === '' || v.pain == null ? null : Math.min(10, Math.max(0, parseInt(v.pain, 10))); v.pain = pain; if (pain != null) logPain(profile, ex.pattern, pain); }
    profile.workouts = profile.workouts || [];
    profile.workouts.push({
      sessionId: sm.sessionId, date: todayIso(), dayIndex: sm.dayIndex, dayName: sm.dayName,
      exercise: ex.name, exerciseId: ex.exerciseId, muscle: ex.muscle, setType: st.setType, setNumber: st.setNumber,
      weight, reps, pain, short: sm.short, savedAt: Date.now(),
    });
    profile.updatedAt = todayIso();
    save();
    renderSessionMode(profile);
    startRestTimer(st.restLabel);
    if (st.setType === 'top') maybeShowRecord(profile, ex, weight, reps);
  }

  /* Fase 5: "nuevo récord" es puramente informativo para motivar en el
   * momento (no toca el plan ni ninguna regla): compara el 1RM estimado
   * del top set recién logueado, con la fórmula de Epley, contra el
   * mejor 1RM estimado del mismo ejercicio en sesiones ANTERIORES
   * (nunca la actual). Máximo una vez por ejercicio y por sesión. */
  function maybeShowRecord(profile, ex, weight, reps) {
    sm.recordShown = sm.recordShown || new Set();
    if (sm.recordShown.has(ex.name) || !weight) return;
    const prior = (profile.workouts || []).filter(w => w.exercise === ex.name && w.setType === 'top' && w.sessionId !== sm.sessionId);
    if (!prior.length) return;
    const epley = (w, r) => w * (1 + r / 30);
    const priorBest = Math.max(...prior.map(w => epley(w.weight, w.reps)));
    if (epley(weight, reps) <= priorBest) return;
    sm.recordShown.add(ex.name);
    showRecordMoment(profile, weight, reps);
  }

  function showRecordMoment(profile, weight, reps) {
    if (navigator.vibrate) navigator.vibrate([90, 70, 90]);
    const bar = document.getElementById('platebar-top');
    if (bar) { bar.classList.add('plate-bounce'); setTimeout(() => bar.classList.remove('plate-bounce'), 550); }
    const root = document.getElementById('session-mode-root');
    if (!root) return;
    const unit = profile.data.plateUnit || 'kg';
    const banner = document.createElement('div');
    banner.className = 'record-banner';
    banner.innerHTML = `${icon('trophy')}<span>Nuevo récord: ${n1(weight)} ${unit} × ${reps}</span>`;
    root.appendChild(banner);
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));
    setTimeout(() => { banner.classList.remove('show'); setTimeout(() => banner.remove(), 300); }, 2000);
  }

  const TIMER_RING_R = 52;
  const TIMER_RING_C = 2 * Math.PI * TIMER_RING_R;

  function startRestTimer(restLabel) {
    const total = parseRestSeconds(restLabel);
    smTimerState = { remaining: total, total };
    const root = document.getElementById('session-mode-root');
    closeTimer();
    const ov = document.createElement('div'); ov.className = 'timer-overlay'; ov.id = 'sm-timer';
    ov.innerHTML = `<div class="timer-label">Descanso</div>
      <div class="timer-ring-wrap" id="sm-timer-ring-wrap">
        <svg class="timer-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="${TIMER_RING_R}"></circle>
          <circle class="ring-fg" id="sm-timer-ring-fg" cx="60" cy="60" r="${TIMER_RING_R}" stroke-dasharray="${TIMER_RING_C.toFixed(1)}" stroke-dashoffset="0"></circle>
        </svg>
        <div class="timer-num-wrap"><div class="timer-num" id="sm-timer-num">${fmtTimer(total)}</div></div>
      </div>
      <div class="timer-actions"><button class="btn btn-lg" id="sm-timer-plus30">+30 s</button><button class="btn btn-primary btn-lg" id="sm-timer-skip">Saltar</button></div>`;
    root.appendChild(ov);
    const updateTimerUi = () => {
      const r = Math.max(0, smTimerState.remaining);
      const numEl = document.getElementById('sm-timer-num'); if (numEl) numEl.textContent = fmtTimer(r);
      const fg = document.getElementById('sm-timer-ring-fg');
      if (fg) fg.style.strokeDashoffset = (TIMER_RING_C * (1 - Math.min(1, r / smTimerState.total))).toFixed(1);
      const ring = ov.querySelector('.timer-ring'); if (ring) ring.classList.toggle('urgent', r <= 10 && r > 0);
    };
    updateTimerUi();
    $('#sm-timer-plus30').onclick = () => { smTimerState.remaining += 30; updateTimerUi(); };
    $('#sm-timer-skip').onclick = () => closeTimer();
    smTimerInterval = setInterval(() => {
      smTimerState.remaining -= 1;
      updateTimerUi();
      if (smTimerState.remaining <= 0) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        clearInterval(smTimerInterval); smTimerInterval = null;
        const wrap = document.getElementById('sm-timer-ring-wrap');
        if (wrap) { wrap.classList.add('pulse'); setTimeout(closeTimer, 500); } else closeTimer();
      }
    }, 1000);
  }
  function closeTimer() {
    if (smTimerInterval) { clearInterval(smTimerInterval); smTimerInterval = null; }
    const ov = document.getElementById('sm-timer'); if (ov) ov.remove();
  }

  function priorTopWeightFor(profile, exerciseName) {
    const all = (profile.workouts || []).filter(w => w.exercise === exerciseName && w.setType === 'top' && w.sessionId !== sm.sessionId);
    if (!all.length) return null;
    let last = all[0];
    all.forEach(w => { if (w.savedAt > last.savedAt) last = w; });
    return last.weight;
  }

  function htmlSmSummary(profile) {
    const flatVals = sm.values.flat();
    const doneCount = flatVals.filter(v => v.done).length;
    const totalCount = flatVals.length;
    const pending = sm.exercises.filter((e, i) => sm.values[i].some(v => !v.done)).map(e => e.name);
    const durationMin = Math.max(1, Math.round((Date.now() - sm.startedAt) / 60000));
    const topSets = [];
    sm.exercises.forEach((e, i) => e.sets.forEach((st, j) => {
      const v = sm.values[i][j];
      if (st.setType === 'top' && v.done) topSets.push({ name: e.name, weight: v.weight, reps: v.reps, prior: priorTopWeightFor(profile, e.name) });
    }));
    const topSetRow = t => {
      let cmp = '';
      if (t.prior != null) {
        const diff = round2(t.weight - t.prior);
        const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const ic = dir === 'up' ? 'arrow-up' : dir === 'down' ? 'arrow-down' : 'arrow-flat';
        cmp = `<span class="topset-cmp cmp-${dir}">${icon(ic)} ${diff === 0 ? 'igual' : (diff > 0 ? '+' : '') + n1(diff) + ' kg'}</span>`;
      }
      return `<li><b>${esc(t.name)}</b>: ${n1(t.weight)} kg × ${t.reps} ${cmp}</li>`;
    };
    return `<div class="session-mode">
      <div class="session-mode-head"><div></div><div class="prog">Resumen de la sesión</div><div></div></div>
      <div class="session-mode-body">
        <div class="card accent">
          <h2>${esc(sm.dayName)} ${sm.short ? '· versión corta' : ''}</h2>
          <div class="grid">
            <div class="stat"><div class="v">${doneCount}/${totalCount}</div><div class="l">series hechas</div></div>
            <div class="stat"><div class="v">${durationMin}</div><div class="l">min reales</div></div>
          </div>
        </div>
        ${topSets.length ? `<div class="card"><h3>Top sets del día</h3><ul>${topSets.map(topSetRow).join('')}</ul></div>` : ''}
        ${pending.length ? `<div class="card"><h3>Ejercicios con series sin terminar</h3><ul>${pending.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '<div class="card"><p class="muted">Todas las series quedaron registradas. ¡Bien ahí!</p></div>'}
        <button class="btn btn-primary btn-block btn-lg" id="sm-back-to-plan">Volver al plan</button>
      </div>
    </div>`;
  }
  function wireSmSummary() { $('#sm-back-to-plan').onclick = () => { endSessionMode(); render(); }; }

  /* Fase 6: encabezado de Progreso con 4 métricas derivadas del log (vista
   * pura, no participan de ningún cálculo del plan). */
  function htmlProgressHeader(log, plan) {
    const t = plan.targets;
    let avg7 = null, totalChange = null, realRate = null;
    if (log.length) {
      const lastDate = new Date(log[log.length - 1].date + 'T00:00:00').getTime();
      const windowStart = lastDate - 6 * 86400000;
      const inWindow = log.filter(e => new Date(e.date + 'T00:00:00').getTime() >= windowStart);
      avg7 = inWindow.reduce((s, e) => s + e.weightKg, 0) / inWindow.length;
    }
    if (log.length >= 2) {
      totalChange = log[log.length - 1].weightKg - log[0].weightKg;
      const days = (new Date(log[log.length - 1].date + 'T00:00:00') - new Date(log[0].date + 'T00:00:00')) / 86400000;
      if (days > 0) realRate = totalChange / (days / 7);
    }
    const fmtKg = v => v == null ? '—' : `${v > 0 ? '+' : ''}${n1(v)} kg`;
    const fmtRate = v => v == null ? '—' : `${v > 0 ? '+' : ''}${n2(v)} kg/sem`;
    const previstoLabel = plan.input.goal === 'maintain' ? 'previsto 0' : `previsto ${plan.input.goal === 'cut' ? '−' : '+'}${n2(Math.abs(t.rateKg))} kg/sem`;
    return `<div class="grid" style="margin-top:.8rem">
      <div class="stat"><div class="v">${avg7 != null ? n1(avg7) + ' kg' : '—'}</div><div class="l">peso actual</div><div class="s">promedio 7 días</div></div>
      <div class="stat"><div class="v">${fmtKg(totalChange)}</div><div class="l">cambio desde el inicio</div></div>
      <div class="stat"><div class="v">${fmtRate(realRate)}</div><div class="l">ritmo real</div><div class="s">${previstoLabel}</div></div>
      <div class="stat"><div class="v">${plan.input.goal === 'maintain' ? '—' : n0(t.weeksNeeded) + ' sem'}</div><div class="l">estimado al objetivo</div></div>
    </div>`;
  }

  /* ---------- Progreso ---------- */
  function renderProgress() {
    const p = active();
    if (!p) { view.innerHTML = `<div class="empty"><div class="big">${icon('trend-down')}</div><p>Abre un perfil para registrar su progreso.</p></div>`; return; }
    const plan = ENGINE.buildPlan(p.data, todayIso());
    const log = (p.log || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const workouts = p.workouts || [];
    const exNames = [...new Set(workouts.map(w => w.exercise))];
    if (!ui.strengthExercise || !exNames.includes(ui.strengthExercise)) ui.strengthExercise = exNames[0] || null;
    view.innerHTML = `
      <div class="card accent">
        <h2>Progreso · ${esc(p.data.name)}</h2>
        ${htmlProgressHeader(log, plan)}
        <form id="log-form">
          <div class="row2">
            <div><label>Peso (kg)</label><input name="weightKg" type="number" step="0.1" inputmode="decimal" required autofocus></div>
            <div><label>Fecha</label><input name="date" type="date" value="${todayIso()}" required></div>
          </div>
          <div class="row3">
            <div><label>% grasa</label><input name="bodyFatPct" type="number" step="0.1" inputmode="decimal"></div>
            <div><label>Cintura (cm)</label><input name="waistCm" type="number" step="0.5" inputmode="decimal"></div>
            <div><label>Cuello (cm)</label><input name="neckCm" type="number" step="0.5" inputmode="decimal"></div>
          </div>
          <div class="row2">
            <div><label>Cadera (cm)</label><input name="hipCm" type="number" step="0.5" inputmode="decimal"></div>
          </div>
          <div><label>Notas</label><input name="notes" placeholder="energía, fuerza, sueño…" style="width:100%"></div>
          <div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Guardar medición</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Peso vs. objetivo</h3>
        ${weightChart(log, plan)}
        <p class="help">${rateLabel(plan)}</p>
      </div>
      <div class="card">
        <h3>Fuerza</h3>
        ${strengthSection(workouts)}
      </div>
      <div class="card">
        <h3>Historial</h3>
        ${log.length ? `<table><tr><th>Fecha</th><th class="num">Peso</th><th class="num">% grasa</th><th class="num">Cintura</th><th></th></tr>
        ${log.slice().reverse().map((e, i) => `<tr><td>${fmtDate(e.date)}<br><small>${esc(e.notes || '')}</small></td><td class="num">${n1(e.weightKg)} kg</td><td class="num">${e.bodyFatPct ? n1(e.bodyFatPct) + ' %' : '—'}</td><td class="num">${e.waistCm ? n1(e.waistCm) : '—'}</td><td class="num"><button class="btn btn-ghost" data-del="${log.length - 1 - i}" title="Eliminar">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Sin mediciones todavía.</p>'}
        ${log.length ? '<div class="btn-row"><button class="btn" id="btn-apply">Usar la última medición y recalcular</button></div>' : ''}
      </div>`;

    $('#log-form').onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      const num = v => { const x = parseFloat(v); return isFinite(x) && x > 0 ? x : null; };
      const entry = { date: d.date, weightKg: num(d.weightKg), bodyFatPct: num(d.bodyFatPct), waistCm: num(d.waistCm), neckCm: num(d.neckCm), hipCm: num(d.hipCm), notes: (d.notes || '').trim() };
      if (!entry.weightKg) { toast('Indica el peso'); return; }
      p.log = p.log || []; p.log.push(entry); p.updatedAt = todayIso(); save(); toast('Medición guardada'); renderProgress();
    };
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const idx = Number(b.dataset.del); const sorted = log; const target = sorted[idx];
      p.log = p.log.filter(x => x !== target); save(); renderProgress();
    });
    const sel = $('#strength-exercise-select');
    if (sel) sel.onchange = () => { ui.strengthExercise = sel.value; renderProgress(); };
    const apply = $('#btn-apply');
    if (apply) apply.onclick = async () => {
      const ok = await confirmModal('Esto recalcula calorías y proteína del plan. ¿Continuar?', { confirmLabel: 'Recalcular', cancelLabel: 'Cancelar' });
      if (!ok) return;
      const last = log[log.length - 1];
      p.data.weightKg = last.weightKg;
      if (last.bodyFatPct) p.data.bodyFatPct = last.bodyFatPct;
      if (last.waistCm) p.data.waistCm = last.waistCm;
      if (last.neckCm) p.data.neckCm = last.neckCm;
      if (last.hipCm) p.data.hipCm = last.hipCm;
      p.updatedAt = todayIso(); save(); toast('Datos actualizados'); ui.planTab = 'summary'; go('plan');
    };
  }

  function rateLabel(plan) {
    if (plan.input.goal === 'maintain') return 'Mantenimiento: sin ritmo de cambio de peso proyectado.';
    const sign = plan.input.goal === 'cut' ? '−' : '+';
    return `Ritmo previsto: ${sign}${n2(Math.abs(plan.targets.rateKg))} kg/semana · objetivo ${n1(plan.targets.targetWeight)} kg.`;
  }

  function weightChart(log, plan) {
    const W = 340, H = 180, L = 40, R = 10, T = 10, B = 24;
    if (log.length < 2) return `<p class="muted">Registrá tu peso 3-4 veces por semana, en ayunas, para ver la tendencia.</p>`;
    const target = plan.targets.targetWeight;
    const xs = log.map(e => new Date(e.date + 'T00:00:00').getTime());
    const ys = log.map(e => e.weightKg);
    const projecting = plan.input.goal !== 'maintain';
    const estDate = new Date(plan.targets.estimatedDate + 'T00:00:00').getTime();
    const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 7 * 86400000, projecting ? estDate : x0);
    const yVals = projecting ? [...ys, target] : ys;
    const yMin = Math.min(...yVals) - 1, yMax = Math.max(...yVals) + 1;
    const X = x => L + (x - x0) / (x1 - x0) * (W - L - R);
    const Y = y => T + (yMax - y) / (yMax - yMin) * (H - T - B);

    // Pesajes casi diarios (mediana del intervalo entre mediciones <= 2 días):
    // la línea principal pasa a ser la media móvil de 7 días, y cada pesaje
    // individual queda como punto tenue de fondo.
    const gaps = []; for (let i = 1; i < xs.length; i++) gaps.push((xs[i] - xs[i - 1]) / 86400000);
    gaps.sort((a, b) => a - b);
    const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : Infinity;
    const nearDaily = log.length >= 5 && medianGap <= 2;

    let mainPath, dotsHtml;
    if (nearDaily) {
      const ma = log.map((e, i) => {
        const windowStart = xs[i] - 6 * 86400000;
        const inWindow = log.filter((_, j) => xs[j] >= windowStart && xs[j] <= xs[i]);
        return inWindow.reduce((s, x) => s + x.weightKg, 0) / inWindow.length;
      });
      mainPath = ma.map((y, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
      dotsHtml = log.map((e, i) => `<circle class="dot-faint" cx="${X(xs[i]).toFixed(1)}" cy="${Y(e.weightKg).toFixed(1)}" r="2.2"><title>${fmtDate(e.date)}: ${n1(e.weightKg)} kg</title></circle>`).join('');
    } else {
      mainPath = log.map((e, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(e.weightKg).toFixed(1)}`).join(' ');
      dotsHtml = log.map((e, i) => `<circle class="dot" cx="${X(xs[i]).toFixed(1)}" cy="${Y(e.weightKg).toFixed(1)}" r="3"><title>${fmtDate(e.date)}: ${n1(e.weightKg)} kg</title></circle>`).join('');
    }
    const projection = projecting ? `<line class="line2" x1="${X(xs[0]).toFixed(1)}" y1="${Y(ys[0]).toFixed(1)}" x2="${X(estDate).toFixed(1)}" y2="${Y(target).toFixed(1)}"/>` : '';
    const ticks = [yMin + 1, (yMin + yMax) / 2, yMax - 1].map(v => `<text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${n1(v)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <line class="target" x1="${L}" y1="${Y(target)}" x2="${W - R}" y2="${Y(target)}"/>
      ${projection}
      ${ticks}<path class="line" pathLength="100" d="${mainPath}"/>${dotsHtml}
      <text x="${L}" y="${H - 6}">${fmtDate(log[0].date)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDate(log[log.length - 1].date)}</text>
    </svg>`;
  }

  function strengthSection(workouts) {
    if (!workouts.length) return '<p class="muted">Completá dos sesiones para ver tu evolución de fuerza.</p>';
    const names = [...new Set(workouts.map(w => w.exercise))];
    const selector = `<select id="strength-exercise-select">${names.map(n => `<option value="${esc(n)}" ${n === ui.strengthExercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const points = strengthPointsFor(workouts, ui.strengthExercise);
    if (points.length < 2) return `${selector}<p class="muted">Completá dos sesiones para ver tu evolución de fuerza.</p>`;
    return `${selector}${strengthChart(points)}<p class="help">Marca hueca = sesión corta.</p>`;
  }

  function strengthPointsFor(workouts, exerciseName) {
    const byDate = {};
    workouts.filter(w => w.exercise === exerciseName).forEach(w => { (byDate[w.date] = byDate[w.date] || []).push(w); });
    return Object.keys(byDate).sort().map(date => {
      const sets = byDate[date];
      const best = sets.find(s => s.setType === 'top') || sets.slice().sort((a, b) => b.weight - a.weight)[0];
      return { date, weight: best.weight, reps: best.reps, short: sets.some(s => s.short) };
    });
  }

  function strengthChart(points) {
    const W = 340, H = 160, L = 36, R = 8, T = 10, B = 24;
    const xs = points.map(p => new Date(p.date + 'T00:00:00').getTime());
    const ys = points.map(p => p.weight);
    const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 7 * 86400000);
    const yMin = Math.min(...ys) - 2.5, yMax = Math.max(...ys) + 2.5;
    const X = x => L + (x - x0) / (x1 - x0) * (W - L - R);
    const Y = y => T + (yMax - y) / (yMax - yMin) * (H - T - B);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
    const dots = points.map((p, i) => `<circle class="${p.short ? 'dot-short' : 'dot'}" cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3.5"><title>${fmtDate(p.date)}: ${n1(p.weight)} kg × ${p.reps}${p.short ? ' (sesión corta)' : ''}</title></circle>`).join('');
    const ticks = [yMin + 1, (yMin + yMax) / 2, yMax - 1].map(v => `<text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${n1(v)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del top set">
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      ${ticks}<path class="line" pathLength="100" d="${path}"/>${dots}
      <text x="${L}" y="${H - 6}">${fmtDate(points[0].date)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>
    </svg>`;
  }

  /* ---------- Fuentes ---------- */
  function renderSources() {
    const list = Object.values(KNOWLEDGE.SOURCES);
    view.innerHTML = `
      <div class="card accent">
        <h2>Fuentes utilizadas</h2>
        <p class="muted">Todas las cifras del plan proceden de estas referencias: revisiones sistemáticas, metaanálisis, posicionamientos oficiales de sociedades científicas (ISSN, ACSM), organismos reguladores y el reglamento federativo. No se usan blogs, foros ni opiniones de influencers. Las reglas de seguridad propias de la app (límite de déficit al 30 % y suelo en el gasto en reposo) se señalan como tales cuando se aplican.</p>
      </div>
      <div class="card">
        ${list.map(s => `<div class="source-item"><div class="k">${esc(s.type)} · ${esc(s.id)}</div><div class="t">${esc(s.short)}</div><div class="muted">${esc(s.title)}</div><a href="${esc(s.url)}" target="_blank" rel="noopener">Ver referencia</a></div>`).join('')}
      </div>
      <div class="card">
        <h3>Limitaciones conocidas</h3>
        <ul>
          <li>Los rangos de grasa "en tarima" por división son estimaciones basadas en estudios de caso y no un criterio oficial de la IFBB.</li>
          <li>La tabla de peso de Classic Physique es la de 2023 y puede haber cambiado: verifícala en el reglamento vigente.</li>
          <li>Las ecuaciones de gasto energético tienen un error individual de ±10 %: la báscula y el ajuste semanal mandan.</li>
          <li>La app no sustituye a un médico, dietista-nutricionista o entrenador certificado.</li>
        </ul>
      </div>
      <p class="muted" style="font-size:.75rem">Training Agent · versión 1.0 · datos guardados solo en este dispositivo.</p>`;
  }

  /* ---------- PWA ---------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e; $('#btn-install').hidden = false;
  });
  $('#btn-install').onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; deferredPrompt = null; $('#btn-install').hidden = true;
  };
  window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; toast('App instalada'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- Arranque ---------- */
  if (active()) ui.tab = 'plan';
  go(ui.tab);
})();
