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
  const fmtDate = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const cite = ids => (Array.isArray(ids) ? ids : [ids]).map(id => `<span class="cite" title="${esc(KNOWLEDGE.SOURCES[id] ? KNOWLEDGE.SOURCES[id].short : id)}">${esc(id)}</span>`).join('');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Navegación ---------- */
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  function go(tab) {
    ui.tab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    render();
    window.scrollTo({ top: 0 });
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
      ${items || '<div class="empty"><div class="big">🏋️</div><p>Aún no hay perfiles.<br>Crea el primero para obtener tu plan.</p></div>'}
      ${active() ? `<div class="card">
        <h3>Perfil activo: ${esc(active().data.name)}</h3>
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

  /* ---------- Datos ---------- */
  function renderData() {
    const editing = ui.editingId ? state.profiles.find(p => p.id === ui.editingId) : null;
    const d = editing ? editing.data : { sex: 'M', activity: 'moderate', level: 'intermediate', daysPerWeek: 4, goal: 'cut', division: 'classic_m' };
    const opt = (list, val, fmt) => list.map(x => `<option value="${esc(fmt ? fmt(x).v : x.id)}" ${(fmt ? fmt(x).v : x.id) === val ? 'selected' : ''}>${esc(fmt ? fmt(x).l : x.label)}</option>`).join('');
    const divisions = Object.values(KNOWLEDGE.DIVISIONS);

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

    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = ENGINE.validateProfile(data);
      if (errors.length) { $('#form-errors').innerHTML = errors.map(x => `<div class="alert danger">${esc(x)}</div>`).join(''); window.scrollTo({ top: document.body.scrollHeight }); return; }
      const norm = ENGINE.normalizeProfile(data);
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
    if (!p) { view.innerHTML = '<div class="empty"><div class="big">🎯</div><p>Crea o abre un perfil para ver su plan.</p><button class="btn btn-primary" id="e-new">Nuevo perfil</button></div>'; $('#e-new').onclick = () => go('data'); return; }
    const plan = ENGINE.buildPlan(p.data, todayIso());
    const tabs = [['summary', 'Resumen'], ['nutrition', 'Dieta'], ['training', 'Entreno'], ['targets', 'Medidas'], ['supps', 'Suplementos']];
    view.innerHTML = `
      <div class="subtabs">${tabs.map(([id, l]) => `<button class="btn ${ui.planTab === id ? 'active' : ''}" data-pt="${id}">${l}</button>`).join('')}</div>
      <div id="plan-body"></div>`;
    view.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { ui.planTab = b.dataset.pt; renderPlan(); });
    const body = $('#plan-body');
    if (ui.planTab === 'summary') body.innerHTML = htmlSummary(plan, p);
    else if (ui.planTab === 'nutrition') body.innerHTML = htmlNutrition(plan);
    else if (ui.planTab === 'training') body.innerHTML = htmlTraining(plan);
    else if (ui.planTab === 'targets') body.innerHTML = htmlTargets(plan);
    else body.innerHTML = htmlSupps(plan);
    const share = $('#btn-share');
    if (share) share.onclick = () => sharePlan(plan);
  }

  function alerts(list) { return list.map(w => `<div class="alert ${w.level}">${esc(w.text)}</div>`).join(''); }

  function htmlSummary(plan, profile) {
    const m = plan.metrics, t = plan.targets, n = plan.nutrition, tr = plan.training;
    const goalLabel = { cut: 'Definición', bulk: 'Volumen', maintain: 'Mantenimiento' }[plan.input.goal];
    return `
      <div class="card accent">
        <h2>${esc(plan.input.name)}</h2>
        <p class="muted">${esc(t.division.label)} · ${goalLabel} · generado ${fmtDate(plan.generatedAt)}</p>
        ${alerts(plan.warnings)}
        <div class="grid">
          <div class="stat"><div class="v">${n0(n.calories)}</div><div class="l">kcal/día (${esc(n.deltaLabel)})</div></div>
          <div class="stat"><div class="v">${n.protein} g</div><div class="l">proteína</div></div>
          <div class="stat"><div class="v">${n.carbs} g</div><div class="l">carbohidratos</div></div>
          <div class="stat"><div class="v">${n.fat} g</div><div class="l">grasas</div></div>
          <div class="stat"><div class="v">${n1(m.bodyFat)} %</div><div class="l">grasa actual</div><div class="s">${esc(m.bfMethod)}</div></div>
          <div class="stat"><div class="v">${n1(t.targetBf)} %</div><div class="l">grasa objetivo</div></div>
          <div class="stat"><div class="v">${n1(t.targetWeight)} kg</div><div class="l">peso objetivo</div><div class="s">${t.delta >= 0 ? '+' : ''}${n1(t.delta)} kg</div></div>
          <div class="stat"><div class="v">${plan.input.goal === 'maintain' ? '—' : n0(t.weeksNeeded) + ' sem'}</div><div class="l">duración estimada</div><div class="s">${plan.input.goal === 'maintain' ? '' : 'hasta ' + fmtDate(t.estimatedDate)}</div></div>
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
        <div class="legend"><span><i style="background:var(--accent-2)"></i>Proteína ${pct(n.protein * 4)} %</span><span><i style="background:var(--info)"></i>Carbohidrato ${pct(n.carbs * 4)} %</span><span><i style="background:var(--accent)"></i>Grasa ${pct(n.fat * 9)} %</span></div>
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
    const setsRows = Object.entries(tr.weeklySets).map(([mu, s]) => `<tr><td>${esc(KNOWLEDGE.MUSCLE_LABELS[mu])}</td><td class="num">${s}</td></tr>`).join('');
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
      ${tr.sessions.map(s => `<div class="session"><h4>${esc(s.name)} <small>${s.totalSets} series</small></h4>
        ${s.exercises.map(e => `<div class="ex"><div><div class="n">${esc(e.name)}</div><div class="m">${esc(e.muscleLabel)} · RIR ${e.rir} · descanso ${e.rest}</div></div><div class="s">${e.sets} × ${e.reps}</div></div>`).join('')}
      </div>`).join('')}
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
        <p>Peso objetivo ${n1(t.targetWeight)} kg: ${cl.status === 'ok' ? `<b style="color:var(--accent-2)">dentro del límite</b> con ${n1(cl.marginKg)} kg de margen.` : `<b style="color:var(--danger)">supera el límite</b> en ${n1(-cl.marginKg)} kg.`}</p>
        <p class="help">La tabla de la app es la de agosto de 2023 y hubo cambios para 2025. Confirma el límite en el reglamento vigente de la IFBB Pro League e introdúcelo en Datos si difiere.</p>
      </div>` : ''}
      <div class="card">
        <h3>Calendario</h3>
        ${p.goal === 'maintain' ? '<p>Fase de mantenimiento: reevalúa medidas cada 4 semanas.</p>' : `
        <ul>
          <li>Ritmo: ${t.ratePct} % del peso/semana (${n1(t.rateKg * 1000)} g/semana).</li>
          <li>Duración estimada: <b>${n0(t.weeksNeeded)} semanas</b> → ${fmtDate(t.estimatedDate)}.</li>
          ${p.targetDate ? `<li>Fecha objetivo indicada: ${fmtDate(p.targetDate)} → ${t.dateFeasible === false ? '<b style="color:var(--danger)">no alcanzable con seguridad</b>' : '<b style="color:var(--accent-2)">alcanzable</b>'}.</li>` : ''}
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
    const text = `IFBB Pro Agent · ${plan.input.name}\n${t.division.label} · ${plan.input.goal}\n` +
      `Calorías: ${n.calories} kcal (P ${n.protein} g · C ${n.carbs} g · G ${n.fat} g)\n` +
      `Grasa ${Math.round(plan.metrics.bodyFat * 10) / 10} % → ${t.targetBf} % · Peso ${plan.input.weightKg} → ${Math.round(t.targetWeight * 10) / 10} kg en ~${Math.round(t.weeksNeeded)} semanas\n` +
      `Entreno: ${plan.training.splitName}, ${plan.training.daysPerWeek} días/semana`;
    if (navigator.share) navigator.share({ title: 'Plan IFBB Pro Agent', text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Resumen copiado'));
  }

  /* ---------- Progreso ---------- */
  function renderProgress() {
    const p = active();
    if (!p) { view.innerHTML = '<div class="empty"><div class="big">📈</div><p>Abre un perfil para registrar su progreso.</p></div>'; return; }
    const plan = ENGINE.buildPlan(p.data, todayIso());
    const log = (p.log || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    view.innerHTML = `
      <div class="card accent">
        <h2>Progreso · ${esc(p.data.name)}</h2>
        <form id="log-form">
          <div class="row2">
            <div><label>Fecha</label><input name="date" type="date" value="${todayIso()}" required></div>
            <div><label>Peso (kg)</label><input name="weightKg" type="number" step="0.1" inputmode="decimal" required></div>
          </div>
          <div class="row3">
            <div><label>% grasa</label><input name="bodyFatPct" type="number" step="0.1" inputmode="decimal"></div>
            <div><label>Cintura (cm)</label><input name="waistCm" type="number" step="0.5" inputmode="decimal"></div>
            <div><label>Cuello (cm)</label><input name="neckCm" type="number" step="0.5" inputmode="decimal"></div>
          </div>
          <div class="row2">
            <div><label>Cadera (cm)</label><input name="hipCm" type="number" step="0.5" inputmode="decimal"></div>
            <div><label>Notas</label><input name="notes" placeholder="energía, fuerza, sueño…"></div>
          </div>
          <div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Guardar medición</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Peso vs. objetivo</h3>
        ${chart(log, plan)}
        <p class="help">Línea roja: peso objetivo (${n1(plan.targets.targetWeight)} kg). Ritmo previsto: ${plan.input.goal === 'cut' ? '−' : '+'}${n1(plan.targets.rateKg * 1000)} g/semana.</p>
      </div>
      <div class="card">
        <h3>Historial</h3>
        ${log.length ? `<table><tr><th>Fecha</th><th class="num">Peso</th><th class="num">% grasa</th><th class="num">Cintura</th><th></th></tr>
        ${log.slice().reverse().map((e, i) => `<tr><td>${fmtDate(e.date)}<br><small>${esc(e.notes || '')}</small></td><td class="num">${n1(e.weightKg)} kg</td><td class="num">${e.bodyFatPct ? n1(e.bodyFatPct) + ' %' : '—'}</td><td class="num">${e.waistCm ? n1(e.waistCm) : '—'}</td><td class="num"><button class="btn btn-ghost" data-del="${log.length - 1 - i}" title="Eliminar">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Sin mediciones todavía.</p>'}
        ${log.length ? '<div class="btn-row"><button class="btn" id="btn-apply">Usar la última medición como datos actuales y recalcular</button></div>' : ''}
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
    const apply = $('#btn-apply');
    if (apply) apply.onclick = () => {
      const last = log[log.length - 1];
      p.data.weightKg = last.weightKg;
      if (last.bodyFatPct) p.data.bodyFatPct = last.bodyFatPct;
      if (last.waistCm) p.data.waistCm = last.waistCm;
      if (last.neckCm) p.data.neckCm = last.neckCm;
      if (last.hipCm) p.data.hipCm = last.hipCm;
      p.updatedAt = todayIso(); save(); toast('Datos actualizados'); ui.planTab = 'summary'; go('plan');
    };
  }

  function chart(log, plan) {
    const W = 340, H = 160, L = 36, R = 8, T = 10, B = 24;
    const target = plan.targets.targetWeight;
    if (log.length === 0) return `<svg class="chart" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle">Registra mediciones para ver la gráfica</text></svg>`;
    const xs = log.map(e => new Date(e.date + 'T00:00:00').getTime());
    const ys = log.map(e => e.weightKg);
    const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 7 * 86400000);
    const yMin = Math.min(...ys, target) - 1, yMax = Math.max(...ys, target) + 1;
    const X = x => L + (x - x0) / (x1 - x0) * (W - L - R);
    const Y = y => T + (yMax - y) / (yMax - yMin) * (H - T - B);
    const path = log.map((e, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
    const dots = log.map((e, i) => `<circle class="dot" cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3"><title>${fmtDate(e.date)}: ${n1(e.weightKg)} kg</title></circle>`).join('');
    const ticks = [yMin + 1, (yMin + yMax) / 2, yMax - 1].map(v => `<text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${n1(v)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <line class="target" x1="${L}" y1="${Y(target)}" x2="${W - R}" y2="${Y(target)}"/>
      ${ticks}<path class="line" d="${path}"/>${dots}
      <text x="${L}" y="${H - 6}">${fmtDate(log[0].date)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDate(log[log.length - 1].date)}</text>
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
      <p class="muted" style="font-size:.75rem">IFBB Pro Agent · versión 1.0 · datos guardados solo en este dispositivo.</p>`;
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
