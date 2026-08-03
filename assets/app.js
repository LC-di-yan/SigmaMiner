/* SigmaMiner demo renderer — 纯原生 JS，无框架 */
"use strict";

function $(sel, el) { return (el || document).querySelector(sel); }
function $all(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }

function sanitize(s) {
  if (s === null || s === undefined) return "";
  s = String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  // 只放行内联白名单标签，其余一律转义
  return s.replace(/&lt;(\/?(?:sub|sup|i|b|em|u))&gt;/g, "<$1>");
}
const esc = sanitize;

function pct(x, d) {
  if (x === null || x === undefined) return "—";
  return (Math.round(x * 10) / 10).toFixed(d === undefined ? 1 : d) + "%";
}

let DATA = null;

function evChips(ids) {
  if (!ids || !ids.length) return "";
  const links = ids.map((id) =>
    `<button class="chip rec-link" data-rec="${esc(id)}">${esc(id)}</button>`
  );
  return `<div class="ev">${links.join("")}</div>`;
}

function initRecLinks() {
  $all(".rec-link").forEach((btn) =>
    btn.addEventListener("click", () => {
      const q = $("#record-search");
      q.value = btn.dataset.rec;
      q.dispatchEvent(new Event("input"));
      $("#evidence").scrollIntoView({ behavior: "smooth" });
    })
  );
}

/* ---------- 渲染各区块 ---------- */
function renderProject() {
  const p = DATA.project;
  $("#hero-tagline").textContent = p.tagline;
  $("#hero-subtitle").textContent = p.subtitle;
  $("#foot-generated").textContent = DATA.generated_at;
  document.title = p.name + " · " + p.tagline;
}

function renderHeroStats() {
  const s = DATA.summary;
  const stats = [
    { num: s.records, lab: "篇全文语料" },
    { num: s.core_argyrodite.count, lab: "条核心 argyrodite 记录" },
    { num: s.traceability.percent + "%", lab: "doc_id → record 可回溯" },
    { num: DATA.gaps.length, lab: "个 Research Gap" },
  ];
  $("#hero-stats").innerHTML = stats
    .map((x) => `<div class="bigstat"><div class="num">${esc(x.num)}</div><div class="lab">${esc(x.lab)}</div></div>`)
    .join("");
}

function renderBigStats() {
  const s = DATA.summary;
  const b = DATA.budget;
  const items = [
    { num: s.content_files, lab: "全文存档（content/）" },
    { num: s.hit_catalog, lab: "检索命中（hit_catalog）" },
    { num: b.llm.api_calls, lab: "LLM 抽取调用（DeepSeek）" },
    { num: DATA.routes.length, lab: "候选合成路线（A–E）" },
  ];
  $("#bigstats").innerHTML = items
    .map((x) => `<div class="bigstat card"><div class="num">${esc(x.num)}</div><div class="lab">${esc(x.lab)}</div></div>`)
    .join("");
}

function renderCoverage() {
  const fc = DATA.summary.field_coverage;
  const labels = {
    system: "体系 system", precursor: "前驱体 precursor", synthesis_route: "合成路线",
    ball_milling: "球磨 ball milling", annealing_temp: "退火温度", annealing_time: "退火时间",
    conductivity: "电导率", measurement_temp: "测量温度", activation_energy: "活化能",
    dopant: "掺杂", air_stability: "空气稳定性",
  };
  const order = ["system", "synthesis_route", "conductivity", "precursor", "measurement_temp", "ball_milling", "annealing_temp", "activation_energy", "dopant", "air_stability"];
  $("#coverage-bars").innerHTML = order
    .filter((k) => fc[k])
    .map((k) => {
      const v = fc[k];
      return `<div class="bar">
        <div class="bar-label">${esc(labels[k] || k)}</div>
        <div class="bar-track"><div class="bar-fill" data-w="${v.percent}" style="width:0"></div></div>
        <div class="bar-val">${pct(v.percent)}</div>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() =>
    $all(".bar-fill").forEach((b) => (b.style.width = b.dataset.w + "%"))
  );
}

function renderBudget() {
  const b = DATA.budget;
  const rows = [
    { name: "Sciverse（检索 / 全文）", v: `${b.sciverse.api_calls} 次调用 · ${b.sciverse.total_hits} hits` },
    { name: "DeepSeek（LLM 结构化抽取）", v: `${b.llm.api_calls} 次成功调用` },
    { name: "Materials Project（交叉验证）", v: `${b.materials_project.api_calls} 次调用` },
    { name: "失败查询", v: `${b.sciverse.queries_failed} 次（低并发重试策略）` },
  ];
  $("#budget").innerHTML = rows
    .map((r) => `<div class="budget-item"><span class="bname">${esc(r.name)}</span><span class="bval">${esc(r.v)}</span></div>`)
    .join("");
}

function renderDiscover() {
  const d = DATA.discover;
  if (!d) return;
  const b = d.counts_before, a = d.counts_after;
  $("#disc-head").innerHTML = `
    <div class="goal">目标：${esc(d.goal)}</div>
    <div class="meta">运行 ${d.rounds_run} 轮 · ${esc(d.stop_reason)}
      &nbsp;·&nbsp; 语料 ${b.records}→${a.records}（补检已回退） · Gap ${b.gaps}→${a.gaps} · 假设 ${b.hypotheses}→${a.hypotheses} · 路线 ${b.routes}→${a.routes}</div>`;

  const trail = DATA.discover_rounds
    .map((r) => {
      const chips = compressCalls(r.tool_calls)
        .map((c) => `<span class="disc-step ${c.write ? "write" : ""}">${esc(c.name)}${c.n > 1 ? " ×" + c.n : ""}</span>`)
        .join(`<span class="disc-step arrow">→</span>`);
      return `<span class="disc-step arrow">Round ${r.round}:</span>${chips}`;
    })
    .join("");
  $("#disc-trail").innerHTML = trail;

  const gap = DATA.gaps.find((g) => g.gap_id === "gap_012");
  const hyp = DATA.hypotheses.find((h) => h.hyp_id === "hyp_013");
  const route = DATA.routes.find((r) => r.route_id === "route_E");
  $("#disc-gap").innerHTML = gap
    ? `<div class="mt">${esc(gap.gap_id)} · ${esc(gap.title)}</div>
       <div class="ms">${esc(gap.description)}</div>${evChips(gap.evidence_record_ids)}
       <div class="mk">新颖性：${esc(gap.novelty)}</div>`
    : `<div class="ms">—</div>`;
  $("#disc-hyp").innerHTML = hyp
    ? `<div class="mt">${esc(hyp.hyp_id)} · ${esc(hyp.candidate)}</div>
       <div class="ms">${esc(hyp.rationale)}</div>${evChips(hyp.supporting_records)}
       <div class="mk">机制：${esc(hyp.expected_mechanism)}</div>`
    : `<div class="ms">—</div>`;
  $("#disc-route").innerHTML = route
    ? `<div class="mt">${esc(route.route_id)} · ${esc(route.route_name)}</div>
       <div class="ms">目标组成：${esc(route.target_composition)}</div>${evChips((route.steps || []).flatMap((s) => s.evidence || []).filter((v, i, a) => a.indexOf(v) === i))}`
    : `<div class="ms">—</div>`;
}

function compressCalls(calls) {
  const out = [];
  for (const c of calls || []) {
    const last = out[out.length - 1];
    if (last && last.name === c) last.n++;
    else out.push({ name: c, n: 1, write: c.startsWith("write") });
  }
  return out;
}

function renderGaps() {
  const gaps = DATA.gaps;
  $("#gap-count").textContent = gaps.length;
  const types = [...new Set(gaps.map((g) => g.type))];
  const fl = $("#gap-filters");
  fl.innerHTML = `<button class="filter-chip active" data-t="all">全部 ${gaps.length}</button>` +
    types.map((t) => `<button class="filter-chip" data-t="${esc(t)}">${esc(t)} ${gaps.filter((g) => g.type === t).length}</button>`).join("");
  let active = "all";
  const draw = () => {
    const list = active === "all" ? gaps : gaps.filter((g) => g.type === active);
    $("#gap-cards").innerHTML = list
      .map(
        (g) => `<div class="card gcard">
          <span class="type">${esc(g.gap_id)} · ${esc(g.type)}</span>
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.description)}</p>
          ${evChips(g.evidence_record_ids)}
          <div class="novelty">新颖性：<b>${esc(g.novelty)}</b>${g.created_by ? ` · 由 ${esc(g.created_by)} 产出` : ""}</div>
        </div>`
      )
      .join("");
    initRecLinks();
  };
  fl.addEventListener("click", (e) => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;
    active = chip.dataset.t;
    $all(".filter-chip", fl).forEach((c) => c.classList.toggle("active", c === chip));
    draw();
  });
  draw();
}

function renderHypotheses() {
  const hyps = DATA.hypotheses;
  $("#hyp-count").textContent = hyps.length;
  $("#hyp-cards").innerHTML = hyps
    .map(
      (h) => `<div class="card hcard">
        <span class="rtype">${esc(h.hyp_id)} · ${esc(h.route_type)}</span>
        <h3>${esc(h.candidate)}</h3>
        <p>${esc(h.rationale)}</p>
        ${evChips(h.supporting_records)}
        <div class="novelty">新颖性：<b>${esc(h.novelty)}</b>${h.linked_gap ? ` · 关联 <b>${esc(h.linked_gap)}</b>` : ""}</div>
      </div>`
    )
    .join("");
  initRecLinks();
}

function renderRoutes() {
  const routes = DATA.routes;
  $("#route-count").textContent = routes.length;
  $("#route-cards").innerHTML = routes
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .map(
      (r) => `<div class="card rcard">
        <span class="rtype">${esc(r.route_id)} · 优先级 ${esc(r.priority)} · ${esc(r.linked_gap || "")}</span>
        <h3>${esc(r.route_name)}</h3>
        <div class="target">目标组成：${esc(r.target_composition)}</div>
        <div class="expect">预期：${esc(r.expected_performance)}</div>
        <div class="expect">前驱体：${esc(r.precursors)}</div>
        <ul class="steps">
          ${(r.steps || [])
            .map(
              (s) => `<li><span class="n">${s.step}</span><div><div>${esc(s.action)}</div><div class="cond">条件：${esc(s.conditions)}</div>${evChips(s.evidence)}</div></li>`
            )
            .join("")}
        </ul>
        <div class="novelty"><b>新颖性</b>：${esc(r.novelty)}</div>
        <div class="novelty" style="margin-top:.3rem">${esc(r.rationale)}</div>
      </div>`
    )
    .join("");
  initRecLinks();
}

function renderComparator() {
  const labels = DATA.metric_labels || {};
  const metricKeys = [
    "supported_step_rate",
    "unsupported_claim_rate",
    "temp_label_compliance",
    "constraint_pass_rate",
    "precedent_hit_rate",
    "retraction_rate",
  ];
  const armLabels = {
    fixed: "固定工艺基线",
    purellm: "纯 LLM 基线",
    random: "随机拼接基线",
    lit: "文献 Agent（本文档系统）",
  };
  let html = `<table><thead><tr><th>生成方式</th><th>路线数</th>` +
    metricKeys.map((k) => `<th>${esc(labels[k] || k)}</th>`).join("") + `</tr></thead><tbody>`;
  for (const a of DATA.arms) {
    const m = a.metrics || {};
    html += `<tr><td><b>${esc(armLabels[a.id] || a.label)}</b></td><td>${a.n_routes}</td>` +
      metricKeys
        .map((k) => {
          const v = m[k];
          if (v === undefined) return `<td>—</td>`;
          const good = a.id === "lit" && (k === "supported_step_rate" || k === "constraint_pass_rate" || k === "temp_label_compliance");
          const bad = k === "unsupported_claim_rate" && v === 1 && a.id !== "lit";
          return `<td class="${good ? "highlight" : bad ? "bad" : ""}">${pct(v * 100, 0)}</td>`;
        })
        .join("") + `</tr>`;
  }
  html += `</tbody></table>`;
  $("#comp-table").innerHTML = html;
  $("#comp-interp").textContent = DATA.interpretation;
}

function renderRecords() {
  const recs = DATA.record_index;
  const box = $("#record-cards");
  let query = "";
  const draw = () => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? recs.slice(0, 9)
      : recs.filter((r) =>
          [r.record_id, r.title, r.system, r.dopant, r.synthesis_route, r.conductivity, r.notes, r.journal]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
    $("#record-count").textContent = q
      ? `匹配 ${list.length} / ${recs.length} 条`
      : `${recs.length} 条记录 · 输入关键词检索`;
    box.innerHTML = list
      .map(
        (r) => `<div class="rec">
          <div class="rtop"><div class="rid">${esc(r.record_id)}</div>${r.evidence_level ? `<span class="lev">${esc(r.evidence_level)}</span>` : ""}</div>
          <div class="rtitle">${esc(r.title)}</div>
          <div class="rmeta">${esc(r.year || "")}${r.journal ? " · " + esc(r.journal) : ""}</div>
          <div class="rfields">
            ${r.system ? `<span class="chip">体系 ${esc(r.system)}</span>` : ""}
            ${r.dopant ? `<span class="chip">掺杂 ${esc(r.dopant)}</span>` : ""}
            ${r.synthesis_route ? `<span class="chip">${esc(r.synthesis_route)}</span>` : ""}
            ${r.conductivity ? `<span class="chip gold">σ ${esc(r.conductivity)}</span>` : ""}
            ${r.measurement_temp ? `<span class="chip">${esc(r.measurement_temp)}</span>` : ""}
            ${r.activation_energy ? `<span class="chip">Ea ${esc(r.activation_energy)}</span>` : ""}
            ${r.annealing_temp ? `<span class="chip">退火 ${esc(r.annealing_temp)}</span>` : ""}
          </div>
          ${r.notes ? `<div class="rnotes">${esc(r.notes)}</div>` : ""}
          ${r.source_chunk ? `<div class="rchunk">${esc(r.source_chunk)}</div>` : ""}
        </div>`
      )
      .join("");
    if (!list.length) box.innerHTML = `<p class="lead">无匹配记录，换个关键词试试。</p>`;
  };
  $("#record-search").addEventListener("input", (e) => {
    query = e.target.value;
    draw();
  });
  draw();
}

/* ---------- 启动 ---------- */
fetch("data/app.json")
  .then((r) => r.json())
  .then((d) => {
    DATA = d;
    renderProject();
    renderHeroStats();
    renderBigStats();
    renderCoverage();
    renderBudget();
    renderDiscover();
    renderGaps();
    renderHypotheses();
    renderRoutes();
    renderComparator();
    renderRecords();
  })
  .catch((err) => {
    console.error(err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="padding:2rem;background:#3a0d0d;color:#ff9d9d;font-family:monospace">app.json 加载失败：${esc(String(err))}<br>请先在项目根目录运行 <code>python scripts/build_demo.py</code></div>`
    );
  });
