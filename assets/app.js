/* SigmaMiner demo renderer — 纯原生 JS，无框架 */
"use strict";

function $(sel, el) { return (el || document).querySelector(sel); }
function $all(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }

function sanitize(value) {
  if (value === null || value === undefined) return "";
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped.replace(/&lt;(\/?(?:sub|sup|i|b|em|u))&gt;/g, "<$1>");
}
const esc = sanitize;

function pct(x, digits) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
  return `${(Math.round(Number(x) * 10) / 10).toFixed(digits === undefined ? 1 : digits)}%`;
}

let DATA = null;
let recordQuery = "";
let recordLimit = 12;
let gapQuery = "";
let hypQuery = "";
let routeQuery = "";
let activeGapType = "all";
let toastTimer = null;

function evChips(ids) {
  if (!ids || !ids.length) return "";
  return `<div class="ev">${ids.map((id) => `<button class="chip rec-link" type="button" data-rec="${esc(id)}">${esc(id)}</button>`).join("")}</div>`;
}

function field(value, label) {
  if (!value) return "";
  return `<span><b>${esc(label)}</b>${esc(value)}</span>`;
}

function copyText(text, message) {
  if (!navigator.clipboard) {
    showToast("当前浏览器不支持自动复制");
    return;
  }
  navigator.clipboard.writeText(text).then(() => showToast(message || "已复制")).catch(() => showToast("复制失败，请手动复制"));
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openEvidence(recordId) {
  const record = (DATA.record_index || []).find((item) => item.record_id === recordId);
  if (!record) {
    $("#record-search").value = recordId;
    recordQuery = recordId;
    renderRecords();
    scrollToSection("evidence");
    return;
  }
  const body = $("#evidence-dialog-body");
  const relations = record.relations || [];
  const relationHtml = relations.length
    ? `<div class="relation-list">${relations.map((rel) => `<button class="relation-link" type="button" data-relation-kind="${esc(rel.kind)}" data-relation-id="${esc(rel.id)}">${esc(rel.kind)} · ${esc(rel.id)}</button>`).join("")}</div>`
    : `<p>当前记录尚未被生成结果直接引用。</p>`;
  const source = record.source_excerpt || record.source_chunk || record.notes || "暂无来源摘要";
  body.innerHTML = `
    <div class="evidence-meta">
      <span class="evidence-level">${esc(record.evidence_level || "evidence")}</span>
      <span>${esc(record.year || "年份未知")}</span>
      <span>${esc(record.journal || "期刊信息未抽取")}</span>
    </div>
    <div class="chain-row">
      <span class="chain-node">${esc(record.record_id)}</span><span class="chain-arrow">→</span><span class="chain-node">${esc(record.doc_id || "doc_id 未提供")}</span><span class="chain-arrow">→</span><span class="chain-node">本地全文 JSON</span>
    </div>
    <div class="dialog-actions"><button class="dialog-action" type="button" data-copy-record="${esc(record.record_id)}">复制 record_id</button><button class="dialog-action" type="button" data-copy-doc="${esc(record.doc_id || "")}">复制 doc_id</button></div>
    <div class="evidence-block"><h3>记录标题</h3><p>${esc(record.title)}</p></div>
    <div class="evidence-block"><h3>结构化字段</h3><div class="evidence-meta evidence-fields">${[
      field(record.system, "体系 "), field(record.precursor, "前驱体 "), field(record.dopant, "掺杂 "), field(record.synthesis_route, "路线 "), field(record.ball_milling, "球磨 "), field(record.annealing_temp, "退火温度 "), field(record.annealing_time, "退火时间 "), field(record.conductivity, "电导率 "), field(record.measurement_temp, "测量温度 "), field(record.activation_energy, "活化能 "), field(record.atmosphere, "气氛 "), field(record.air_stability, "空气稳定性 ")
    ].join("")}</div></div>
    <div class="evidence-block"><h3>记录摘要</h3><p>${esc(record.notes || "暂无结构化摘要")}</p></div>
    <div class="evidence-block"><h3>来源证据片段</h3><div class="source-text">${esc(source)}</div></div>
    <div class="evidence-block"><h3>被哪些产出引用</h3>${relationHtml}</div>`;
  const dialog = $("#evidence-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.classList.add("modal-open");
}

function closeEvidence() {
  const dialog = $("#evidence-dialog");
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  document.body.classList.remove("modal-open");
}

function initRecLinks(root) {
  $all(".rec-link", root).forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openEvidence(btn.dataset.rec);
    });
  });
}

function renderProject() {
  const p = DATA.project || {};
  $("#hero-tagline").textContent = p.tagline || "";
  $("#hero-subtitle").textContent = p.subtitle || "";
  $("#foot-generated").textContent = DATA.generated_at || "—";
  $("#overview-date").textContent = DATA.generated_at || "—";
  document.title = `${p.name || "SigmaMiner"} · ${p.tagline || ""}`;
}

function renderHeroStats() {
  const s = DATA.summary || {};
  const stats = [
    { num: s.records, lab: "篇全文语料" },
    { num: s.core_argyrodite && s.core_argyrodite.count, lab: "条核心 argyrodite 记录" },
    { num: `${s.traceability && s.traceability.percent}%`, lab: "doc_id → record 可回溯" },
    { num: (DATA.gaps || []).length, lab: "个 Research Gap" },
  ];
  $("#hero-stats").innerHTML = stats.map((item) => `<div class="bigstat"><div class="num">${esc(item.num)}</div><div class="lab">${esc(item.lab)}</div></div>`).join("");
}

function renderSummary() {
  const s = DATA.summary || {};
  const cards = [
    { no: "01", num: s.records, label: "篇全文语料", desc: "本地全文归档，作为发现输入" },
    { no: "02", num: (DATA.gaps || []).length, label: "个 Research Gap", desc: "从证据组合中识别研究空白" },
    { no: "03", num: (DATA.hypotheses || []).length, label: "条候选假设", desc: "组成、工艺与机制组合" },
    { no: "04", num: (DATA.routes || []).length, label: "条候选合成路线", desc: "逐步骤给出条件与证据" },
  ];
  $("#summary-cards").innerHTML = cards.map((item) => `<div class="summary-card"><span class="summary-no">${item.no}</span><strong class="summary-num">${esc(item.num)}</strong><div class="summary-label">${esc(item.label)}</div><div class="summary-desc">${esc(item.desc)}</div></div>`).join("");
}

function renderBigStats() {
  const s = DATA.summary || {};
  const b = DATA.budget || {};
  const items = [
    { num: s.content_files, lab: "全文存档（content/）" },
    { num: s.hit_catalog, lab: "检索命中（hit_catalog）" },
    { num: b.llm && b.llm.api_calls, lab: "LLM 抽取调用（DeepSeek）" },
    { num: (DATA.routes || []).length, lab: "候选合成路线（A–E）" },
  ];
  $("#bigstats").innerHTML = items.map((item) => `<div class="bigstat card"><div class="num">${esc(item.num)}</div><div class="lab">${esc(item.lab)}</div></div>`).join("");
}

function renderCoverage() {
  const fc = (DATA.summary && DATA.summary.field_coverage) || {};
  const labels = { system: "体系 system", precursor: "前驱体 precursor", synthesis_route: "合成路线", ball_milling: "球磨 ball milling", annealing_temp: "退火温度", annealing_time: "退火时间", conductivity: "电导率", measurement_temp: "测量温度", activation_energy: "活化能", dopant: "掺杂", air_stability: "空气稳定性" };
  const order = ["system", "synthesis_route", "conductivity", "precursor", "measurement_temp", "ball_milling", "annealing_temp", "annealing_time", "activation_energy", "dopant", "air_stability"];
  $("#coverage-bars").innerHTML = order.filter((key) => fc[key]).map((key) => {
    const value = fc[key];
    return `<div class="bar"><div class="bar-label">${esc(labels[key] || key)}</div><div class="bar-track"><div class="bar-fill" data-w="${esc(value.percent)}" style="width:0"></div></div><div class="bar-val">${pct(value.percent)} </div></div>`;
  }).join("");
  requestAnimationFrame(() => $all(".bar-fill").forEach((bar) => { bar.style.width = `${bar.dataset.w}%`; }));
}

function renderBudget() {
  const b = DATA.budget || {};
  const rows = [
    { name: "Sciverse（检索 / 全文）", value: `${b.sciverse && b.sciverse.api_calls} 次调用 · ${b.sciverse && b.sciverse.total_hits} hits` },
    { name: "DeepSeek（LLM 结构化抽取）", value: `${b.llm && b.llm.api_calls} 次成功调用` },
    { name: "Materials Project（交叉验证）", value: `${b.materials_project && b.materials_project.api_calls} 次调用` },
    { name: "失败查询", value: `${b.sciverse && b.sciverse.queries_failed} 次（低并发重试策略）` },
  ];
  $("#budget").innerHTML = rows.map((row) => `<div class="budget-item"><span class="bname">${esc(row.name)}</span><span class="bval">${esc(row.value)}</span></div>`).join("");
}

function renderDiscover() {
  const d = DATA.discover;
  if (!d) return;
  const before = d.counts_before || {};
  const after = d.counts_after || {};
  $("#disc-head").innerHTML = `<div class="goal">目标：${esc(d.goal)}</div><div class="meta">运行 ${esc(d.rounds_run)} 轮 · ${esc(d.stop_reason)} · 发现结果：新增 ${esc(d.new_total && d.new_total.gaps)} Gap、${esc(d.new_total && d.new_total.hypotheses)} 假设、${esc(d.new_total && d.new_total.routes)} 条路线</div>`;
  $("#discover-audit").innerHTML = `<b>审计说明：</b>运行轨迹中的语料为 ${esc(before.records)} → ${esc(after.records)}；补检临时新增 ${esc(after.records - before.records)} 条，最终已回退，审计基线仍为 ${esc(DATA.summary.records)} 条全文。合法生成的 Gap / 假设 / 路线保留。`;
  $("#disc-trail").innerHTML = (DATA.discover_rounds || []).map((round) => {
    const steps = compressCalls(round.tool_calls).map((call) => `<span class="disc-step ${call.write ? "write" : ""}">${esc(call.name)}${call.n > 1 ? ` ×${call.n}` : ""}</span>`).join(`<span class="disc-step arrow">→</span>`);
    return `<div class="timeline-round ${round.round === 1 ? "round-active" : ""}"><div class="round-label"><span><span class="round-index">R${esc(round.round)}</span> Round ${esc(round.round)}</span><span class="hint">${round.round === 1 ? "写回科学产出" : "补检与校验"}</span></div><div class="timeline-steps">${steps || "—"}</div></div>`;
  }).join("");
  const gap = (DATA.gaps || []).find((item) => item.gap_id === "gap_012");
  const hyp = (DATA.hypotheses || []).find((item) => item.hyp_id === "hyp_013");
  const route = (DATA.routes || []).find((item) => item.route_id === "route_E");
  $("#disc-gap").innerHTML = gap ? `<div class="mt">${esc(gap.gap_id)} · ${esc(gap.title)}</div><div class="ms">${esc(gap.description)}</div>${evChips(gap.evidence_record_ids)}<div class="mk">新颖性：${esc(gap.novelty)}</div>` : `<div class="ms">—</div>`;
  $("#disc-hyp").innerHTML = hyp ? `<div class="mt">${esc(hyp.hyp_id)} · ${esc(hyp.candidate)}</div><div class="ms">${esc(hyp.rationale)}</div>${evChips(hyp.supporting_records)}<div class="mk">机制：${esc(hyp.expected_mechanism)}</div>` : `<div class="ms">—</div>`;
  $("#disc-route").innerHTML = route ? `<div class="mt">${esc(route.route_id)} · ${esc(route.route_name)}</div><div class="ms">目标组成：${esc(route.target_composition)}</div>${evChips(uniqueEvidence(route))}<div class="mk">预期：${esc(route.expected_performance)}</div>` : `<div class="ms">—</div>`;
  initRecLinks($("#discover"));
}

function compressCalls(calls) {
  const result = [];
  for (const call of calls || []) {
    const last = result[result.length - 1];
    if (last && last.name === call) last.n += 1;
    else result.push({ name: call, n: 1, write: String(call).startsWith("write") });
  }
  return result;
}

function uniqueEvidence(route) {
  return [...new Set((route.steps || []).flatMap((step) => step.evidence || []))];
}

function renderGaps() {
  const gaps = DATA.gaps || [];
  $("#gap-count").textContent = gaps.length;
  const types = [...new Set(gaps.map((gap) => gap.type))];
  $("#gap-filters").innerHTML = `<button class="filter-chip active" type="button" data-t="all" role="tab" aria-selected="true">全部 ${gaps.length}</button>${types.map((type) => `<button class="filter-chip" type="button" data-t="${esc(type)}" role="tab" aria-selected="false">${esc(type)} ${gaps.filter((gap) => gap.type === type).length}</button>`).join("")}`;
  drawGaps();
}

function drawGaps() {
  const list = (DATA.gaps || []).filter((gap) => {
    const matchesType = activeGapType === "all" || gap.type === activeGapType;
    const haystack = [gap.gap_id, gap.type, gap.title, gap.description, gap.novelty].join(" ").toLowerCase();
    return matchesType && (!gapQuery || haystack.includes(gapQuery));
  });
  $("#gap-cards").innerHTML = list.length ? list.map((gap) => `<article class="card gcard" id="card-${esc(gap.gap_id)}"><span class="type">${esc(gap.gap_id)} · ${esc(gap.type)}</span><h3>${esc(gap.title)}</h3><p>${esc(gap.description)}</p>${evChips(gap.evidence_record_ids)}<div class="novelty">新颖性：<b>${esc(gap.novelty)}</b>${gap.created_by ? `<span class="created-mark">· 自主产出</span>` : ""}</div></article>`).join("") : `<p class="lead">没有匹配的 Gap。</p>`;
  initRecLinks($("#gap-cards"));
}

function renderHypotheses() {
  $("#hyp-count").textContent = (DATA.hypotheses || []).length;
  drawHypotheses();
}

function drawHypotheses() {
  const list = (DATA.hypotheses || []).filter((hypothesis) => {
    const haystack = [hypothesis.hyp_id, hypothesis.route_type, hypothesis.candidate, hypothesis.rationale, hypothesis.expected_mechanism, hypothesis.linked_gap].join(" ").toLowerCase();
    return !hypQuery || haystack.includes(hypQuery);
  });
  $("#hyp-cards").innerHTML = list.length ? list.map((hypothesis) => `<article class="card hcard" id="card-${esc(hypothesis.hyp_id)}"><span class="rtype">${esc(hypothesis.hyp_id)} · ${esc(hypothesis.route_type)}</span><h3>${esc(hypothesis.candidate)}</h3><p>${esc(hypothesis.rationale)}</p>${evChips(hypothesis.supporting_records)}<div class="novelty">新颖性：<b>${esc(hypothesis.novelty)}</b>${hypothesis.linked_gap ? ` · 关联 <b>${esc(hypothesis.linked_gap)}</b>` : ""}</div></article>`).join("") : `<p class="lead">没有匹配的假设。</p>`;
  initRecLinks($("#hyp-cards"));
}

function renderRoutes() {
  $("#route-count").textContent = (DATA.routes || []).length;
  drawRoutes();
}

function drawRoutes() {
  const list = [...(DATA.routes || [])].sort((a, b) => (a.priority || 99) - (b.priority || 99)).filter((route) => {
    const haystack = [route.route_id, route.route_name, route.target_composition, route.expected_performance, route.precursors, route.rationale].join(" ").toLowerCase();
    return !routeQuery || haystack.includes(routeQuery);
  });
  $("#route-cards").innerHTML = list.length ? list.map((route) => {
    const priority = route.route_id === "route_E";
    const detailsId = `route-details-${route.route_id}`;
    return `<article class="card rcard ${priority ? "priority" : ""}" id="card-${esc(route.route_id)}"><span class="rtype">${esc(route.route_id)} · 优先级 ${esc(route.priority)} · ${esc(route.linked_gap || "")}</span>${priority ? `<span class="priority-label">自主发现</span>` : ""}<h3>${esc(route.route_name)}</h3><div class="target">目标组成：${esc(route.target_composition)}</div><div class="expect">预期：${esc(route.expected_performance)}</div><div class="route-summary"><span><b>${(route.steps || []).length}</b>个实验步骤</span><span><b>${uniqueEvidence(route).length}</b>条证据锚点</span></div><button class="route-toggle" type="button" aria-expanded="${priority ? "true" : "false"}" aria-controls="${esc(detailsId)}">${priority ? "收起步骤 ↑" : "展开步骤 ↓"}</button><div class="route-details" id="${esc(detailsId)}" ${priority ? "" : "hidden"}><div class="expect">前驱体：${esc(route.precursors)}</div><ul class="steps">${(route.steps || []).map((step) => `<li><span class="n">${esc(step.step)}</span><div><div>${esc(step.action)}</div><div class="cond">条件：${esc(step.conditions)}</div>${evChips(step.evidence)}</div></li>`).join("")}</ul><div class="novelty"><b>新颖性</b>：${esc(route.novelty)}</div><div class="route-rationale">${esc(route.rationale)}</div></div></article>`;
  }).join("") : `<p class="lead">没有匹配的路线。</p>`;
  initRecLinks($("#route-cards"));
  initRouteToggles();
}

function renderComparator() {
  const labels = DATA.metric_labels || {};
  const metricKeys = ["supported_step_rate", "unsupported_claim_rate", "temp_label_compliance", "constraint_pass_rate", "precedent_hit_rate", "retraction_rate"];
  const arms = DATA.arms || [];
  const lit = arms.find((arm) => arm.id === "lit") || { metrics: {} };
  const m = lit.metrics || {};
  $("#comp-callout").innerHTML = `<div class="callout-item"><strong>${pct((m.supported_step_rate || 0) * 100, 0)}</strong><span>文献 Agent 有证据步骤率</span></div><div class="callout-item"><strong>${pct((m.constraint_pass_rate || 0) * 100, 0)}</strong><span>文献 Agent 约束通过率</span></div><div class="callout-item"><strong>${pct((m.unsupported_claim_rate || 0) * 100, 0)}</strong><span>文献 Agent 无证据断言率</span></div>`;
  const armLabels = { fixed: "固定工艺基线", purellm: "纯 LLM 基线", random: "随机拼接基线", lit: "文献 Agent（本文档系统）" };
  let html = `<table><thead><tr><th scope="col">生成方式</th><th scope="col">路线数</th>${metricKeys.map((key) => `<th scope="col">${esc(labels[key] || key)}</th>`).join("")}</tr></thead><tbody>`;
  for (const arm of arms) {
    const metrics = arm.metrics || {};
    html += `<tr class="${arm.id === "lit" ? "lit-row" : ""}"><td><b>${esc(armLabels[arm.id] || arm.label)}</b></td><td>${esc(arm.n_routes)}</td>${metricKeys.map((key) => { const value = metrics[key]; if (value === undefined) return "<td>—</td>"; const good = arm.id === "lit" && ["supported_step_rate", "constraint_pass_rate", "temp_label_compliance"].includes(key); const bad = key === "unsupported_claim_rate" && value === 1 && arm.id !== "lit"; return `<td class="${good ? "highlight" : bad ? "bad" : ""}">${pct(value * 100, 0)}</td>`; }).join("")}</tr>`;
  }
  $("#comp-table").innerHTML = `${html}</tbody></table>`;
  $("#comp-interp").textContent = DATA.interpretation || "";
}

function recordMatches(record, query) {
  return [record.record_id, record.doc_id, record.title, record.system, record.precursor, record.dopant, record.synthesis_route, record.conductivity, record.measurement_temp, record.activation_energy, record.annealing_temp, record.atmosphere, record.notes, record.journal, record.source_chunk, record.source_excerpt].join(" ").toLowerCase().includes(query);
}

function renderRecords() {
  const records = DATA.record_index || [];
  const query = recordQuery.trim().toLowerCase();
  const matches = query ? records.filter((record) => recordMatches(record, query)) : records;
  const list = matches.slice(0, recordLimit);
  $("#record-count").textContent = query ? `匹配 ${matches.length} / ${records.length} 条` : `${records.length} 条记录 · 点击卡片查看证据详情`;
  $("#record-cards").innerHTML = list.length ? list.map((record) => `<article class="rec" tabindex="0" role="button" data-record-card="${esc(record.record_id)}"><div class="rtop"><div class="rid">${esc(record.record_id)}</div>${record.evidence_level ? `<span class="lev">${esc(record.evidence_level)}</span>` : ""}</div><div class="rtitle">${esc(record.title)}</div><div class="rmeta">${esc(record.year || "")}${record.journal ? ` · ${esc(record.journal)}` : ""}</div><div class="rfields">${record.system ? `<span class="chip">体系 ${esc(record.system)}</span>` : ""}${record.dopant ? `<span class="chip">掺杂 ${esc(record.dopant)}</span>` : ""}${record.synthesis_route ? `<span class="chip">${esc(record.synthesis_route)}</span>` : ""}${record.conductivity ? `<span class="chip gold">σ ${esc(record.conductivity)}</span>` : ""}</div>${record.notes ? `<div class="rnotes">${esc(record.notes)}</div>` : ""}${record.source_chunk ? `<div class="rchunk">${esc(record.source_chunk)}</div>` : ""}</article>`).join("") : `<p class="lead">无匹配记录，换个关键词试试。</p>`;
  const more = $("#record-more");
  more.hidden = matches.length <= list.length || Boolean(query);
  initRecordCards();
}

function initRecordCards() {
  $all("[data-record-card]").forEach((card) => {
    const open = () => openEvidence(card.dataset.recordCard);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
}

function initRouteToggles() {
  $all(".route-toggle").forEach((toggle) => toggle.addEventListener("click", () => {
    const details = document.getElementById(toggle.getAttribute("aria-controls"));
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    toggle.textContent = isOpen ? "展开步骤 ↓" : "收起步骤 ↑";
    details.hidden = isOpen;
  }));
}

function initInteractions() {
  $("#gap-filters").addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;
    activeGapType = chip.dataset.t;
    $all(".filter-chip", $("#gap-filters")).forEach((item) => { const active = item === chip; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
    drawGaps();
  });
  $("#gap-query").addEventListener("input", (event) => { gapQuery = event.target.value.trim().toLowerCase(); drawGaps(); });
  $("#hyp-query").addEventListener("input", (event) => { hypQuery = event.target.value.trim().toLowerCase(); drawHypotheses(); });
  $("#route-query").addEventListener("input", (event) => { routeQuery = event.target.value.trim().toLowerCase(); drawRoutes(); });
  $("#record-search").addEventListener("input", (event) => { recordQuery = event.target.value; recordLimit = 12; renderRecords(); });
  $("#record-more").addEventListener("click", () => { recordLimit += 12; renderRecords(); });
  $("#menu-toggle").addEventListener("click", () => {
    const menu = $("#main-links");
    const open = menu.classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
    $("#menu-toggle").textContent = open ? "关闭" : "菜单";
  });
  $all("#main-links a").forEach((link) => link.addEventListener("click", () => { $("#main-links").classList.remove("open"); $("#menu-toggle").setAttribute("aria-expanded", "false"); $("#menu-toggle").textContent = "菜单"; }));
  $("#back-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $all("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeEvidence));
  $("#evidence-dialog").addEventListener("click", (event) => { if (event.target === $("#evidence-dialog")) closeEvidence(); });
  $("#evidence-dialog").addEventListener("click", (event) => {
    const copyRecord = event.target.closest("[data-copy-record]");
    const copyDoc = event.target.closest("[data-copy-doc]");
    const relation = event.target.closest("[data-relation-id]");
    if (copyRecord) copyText(copyRecord.dataset.copyRecord, "record_id 已复制");
    if (copyDoc && copyDoc.dataset.copyDoc) copyText(copyDoc.dataset.copyDoc, "doc_id 已复制");
    if (relation) { closeEvidence(); const target = document.getElementById(`card-${relation.dataset.relationId}`); if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.classList.add("focus-result"); setTimeout(() => target.classList.remove("focus-result"), 1600); } }
  });
  $all("[data-lightbox]").forEach((button) => button.addEventListener("click", () => openLightbox(button.dataset.lightbox, button.dataset.caption)));
  $all("[data-close-lightbox]").forEach((button) => button.addEventListener("click", closeLightbox));
  $("#lightbox").addEventListener("click", (event) => { if (event.target === $("#lightbox")) closeLightbox(); });
  $all(".copy-command").forEach((button) => button.addEventListener("click", () => copyText($("#" + button.dataset.copyTarget).textContent, "复现命令已复制")));
  window.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeEvidence(); closeLightbox(); } });
}

function openLightbox(src, caption) {
  $("#lightbox-image").src = src;
  $("#lightbox-image").alt = caption || "图片预览";
  $("#lightbox-caption").textContent = caption || "";
  $("#lightbox").hidden = false;
  document.body.classList.add("modal-open");
}

function closeLightbox() {
  $("#lightbox").hidden = true;
  document.body.classList.remove("modal-open");
}

function handleScroll() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  $("#reading-progress").style.width = `${progress}%`;
  $("#back-top").classList.toggle("visible", window.scrollY > 600);
}

function initActiveNav() {
  const links = $all("#main-links a");
  const sections = links.map((link) => document.getElementById(link.getAttribute("href").slice(1))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`)); });
  }, { rootMargin: "-25% 0px -65% 0px" });
  sections.forEach((section) => observer.observe(section));
}

function jumpFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const record = params.get("record");
  if (record) setTimeout(() => openEvidence(record), 150);
}

function renderAll() {
  renderProject();
  renderHeroStats();
  renderSummary();
  renderBigStats();
  renderCoverage();
  renderBudget();
  renderDiscover();
  renderGaps();
  renderHypotheses();
  renderRoutes();
  renderComparator();
  renderRecords();
  initInteractions();
  initActiveNav();
  handleScroll();
}

function showLoadError(error) {
  const loading = $("#app-loading");
  loading.classList.remove("is-hidden");
  loading.innerHTML = `<strong>证据链加载失败</strong><span>${esc(String(error))}</span><span>请确认站点包含 data/app.json，并通过 HTTP 服务访问。</span>`;
}

fetch("data/app.json")
  .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then((data) => { DATA = data; renderAll(); $("#app-loading").classList.add("is-hidden"); jumpFromUrl(); })
  .catch((error) => { console.error(error); showLoadError(error); });
