"use strict";

const STORAGE_KEY = "hardenhelp.rules.v1";
const RISK_TERMS = /\b(ssh|sshd|pam|firewall|lockout|account lock|root login|remote access|authentication|password policy)\b/i;
const DEMO_RULES = [
  {
    os: "Ubuntu 22.04",
    title: "Disable direct SSH root login",
    description: "Illustrative preview: configure the SSH daemon to disallow direct root logins. This is a common hardening requirement; verify its exact wording, severity, identifiers, and applicability in the STIG release for your system.",
    severity: "Unverified",
    ids: [],
    ruleId: "DEMO-SSH-ROOT",
    check: "sudo sshd -T | grep -i '^permitrootlogin'",
    fix: "In /etc/ssh/sshd_config, set PermitRootLogin no. Validate with sudo sshd -t, then reload the SSH service only after confirming a separate privileged account works.",
    source: "Illustrative preview — not an official STIG or SSG rule",
    demo: true
  },
  {
    os: "Ubuntu 22.04",
    title: "Set a minimum password length",
    description: "Illustrative preview: password-length requirements are implemented through the applicable PAM configuration and may vary by release and policy. Do not copy a setting from a different OS version.",
    severity: "Unverified",
    ids: [],
    ruleId: "DEMO-PASSWORD-LENGTH",
    check: "Review the imported rule's check content and the active PAM password stack on the target host.",
    fix: "Use the remediation supplied by the exact imported benchmark. Validate the PAM stack and keep an existing privileged session open while testing.",
    source: "Illustrative preview — not an official STIG or SSG rule",
    demo: true
  },
  {
    os: "Ubuntu 22.04",
    title: "Ensure audit logging is enabled",
    description: "Illustrative preview: audit policy requirements include more than whether the audit daemon is running. Confirm the benchmark's required rules, persistence, and log settings before remediating.",
    severity: "Unverified",
    ids: [],
    ruleId: "DEMO-AUDIT-LOGGING",
    check: "Review the imported rule's check content; an active audit daemon alone does not establish full audit-policy compliance.",
    fix: "Use the release-specific benchmark remediation and confirm audit rules persist after reboot.",
    source: "Illustrative preview — not an official STIG or SSG rule",
    demo: true
  }
];

const elements = {
  search: document.querySelector("#search-input"),
  os: document.querySelector("#os-filter"),
  severity: document.querySelector("#severity-filter"),
  list: document.querySelector("#rule-list"),
  empty: document.querySelector("#empty-state"),
  detail: document.querySelector("#detail-panel"),
  ruleCount: document.querySelector("#rule-count"),
  resultCount: document.querySelector("#result-count"),
  file: document.querySelector("#file-input"),
  toast: document.querySelector("#toast"),
  compareA: document.querySelector("#compare-a"),
  compareB: document.querySelector("#compare-b"),
  compareOutput: document.querySelector("#compare-output"),
  scanFile: document.querySelector("#scan-file-input"),
  scanSummary: document.querySelector("#scan-summary"),
  scanSelect: document.querySelector("#scan-report-select")
};

let rules = DEMO_RULES.slice();
let scanReports = [];
let selectedScanKey = "";
let selectedRuleKey = "";
let toastTimer;
let visibleRuleLimit = 100;

function openDatabase() {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) throw new Error("IndexedDB is unavailable in this browser.");
      const request = window.indexedDB.open("hardenhelp", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("libraries")) db.createObjectStore("libraries");
        if (!db.objectStoreNames.contains("scans")) db.createObjectStore("scans");
      };
      request.onerror = () => reject(request.error || new Error("Could not open the local rule database."));
      request.onsuccess = () => resolve(request.result);
    } catch (error) {
      reject(error);
    }
  });
}

async function loadRules() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("libraries", "readonly").objectStore("libraries").get(STORAGE_KEY);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : null);
    request.onerror = () => reject(request.error || new Error("Could not read the local rule library."));
  });
}

async function loadScanReports() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("scans", "readonly").objectStore("scans").get(STORAGE_KEY);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error("Could not read local scan reports."));
  });
}

async function persistRules() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("libraries", "readwrite");
      transaction.objectStore("libraries").put(rules, STORAGE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the local rule library."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving the local rule library was aborted."));
    });
    return true;
  } catch (error) {
    console.error("Could not save local rule library.", error);
    return false;
  }
}

async function persistScanReports() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("scans", "readwrite");
      transaction.objectStore("scans").put(scanReports, STORAGE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not save local scan reports."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving local scan reports was aborted."));
    });
    return true;
  } catch (error) {
    console.error("Could not save local scan reports.", error);
    return false;
  }
}

function textOf(parent, selector) {
  const node = descendants(parent, selector)[0];
  return node ? node.textContent.trim().replace(/\s+/g, " ") : "";
}

function descendants(parent, name) {
  if (typeof parent.getElementsByTagNameNS === "function") {
    return Array.from(parent.getElementsByTagNameNS("*", name));
  }
  return Array.from(parent.getElementsByTagName(name));
}

function classifySeverity(value, isStig) {
  const upper = (value || "").toUpperCase();
  if (/\bCAT(?:EGORY)?\s*I\b/.test(upper)) return "CAT I";
  if (/\bCAT(?:EGORY)?\s*II\b/.test(upper)) return "CAT II";
  if (/\bCAT(?:EGORY)?\s*III\b/.test(upper)) return "CAT III";
  if (isStig && /\bHIGH\b/.test(upper)) return "CAT I";
  if (isStig && /\bMEDIUM\b/.test(upper)) return "CAT II";
  if (isStig && /\bLOW\b/.test(upper)) return "CAT III";
  return "Unverified";
}

function classifyOs(benchmark, fallback) {
  const searchable = [
    benchmark.getAttribute("id"),
    benchmark.getAttribute("resolved"),
    textOf(benchmark, "title"),
    ...descendants(benchmark, "platform").map((node) => node.getAttribute("id") || "")
  ].join(" ").toLowerCase().replace(/[_-]/g, ".");
  if (/ubuntu.{0,8}24\.04|24\.04.{0,8}ubuntu/.test(searchable)) return "Ubuntu 24.04";
  if (/ubuntu.{0,8}22\.04|22\.04.{0,8}ubuntu/.test(searchable)) return "Ubuntu 22.04";
  if (/rhel.{0,8}9|red.?hat.{0,8}9/.test(searchable)) return "RHEL 9";
  if (/windows.{0,20}server.{0,8}2022|server.{0,8}2022/.test(searchable)) return "Windows Server 2022";
  return fallback;
}

function normalizeIdentifier(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function parseScanResults(xmlText, fileName) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror") || !doc.documentElement) {
    throw new Error("The selected scan report is not valid XML.");
  }
  const testResults = descendants(doc, "TestResult");
  if (!testResults.length) throw new Error("No XCCDF TestResult elements were found.");
  const reports = testResults.map((testResult, index) => {
    const benchmark = descendants(testResult, "benchmark")[0];
    const profile = descendants(testResult, "profile")[0];
    const findings = descendants(testResult, "rule-result").map((ruleResult) => ({
      idref: normalizeIdentifier(ruleResult.getAttribute("idref")),
      result: textOf(ruleResult, "result").toLowerCase() || "unknown"
    })).filter((finding) => finding.idref);
    if (!findings.length) return null;
    const target = textOf(testResult, "target");
    const startTime = textOf(testResult, "start-time");
    const endTime = textOf(testResult, "end-time");
    const testResultId = normalizeIdentifier(testResult.getAttribute("id"));
    return {
      key: `${fileName}::${testResultId || target || "result"}::${startTime || index}`,
      source: fileName,
      benchmarkId: benchmark ? normalizeIdentifier(benchmark.getAttribute("idref")) : "",
      profileId: profile ? normalizeIdentifier(profile.getAttribute("idref")) : "",
      target,
      startTime,
      endTime,
      findings
    };
  }).filter(Boolean);
  if (!reports.length) throw new Error("The XCCDF TestResult contains no rule-result entries.");
  return reports;
}

function parseXccdf(xmlText, fallbackOs, fileName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror") || !doc.documentElement) {
    throw new Error("The selected file is not valid XML.");
  }

  const benchmark = descendants(doc, "Benchmark")[0];
  const detectedOs = benchmark ? classifyOs(benchmark, "") : "";
  const benchmarkOs = detectedOs || (fallbackOs !== "all" ? fallbackOs : "");
  if (!benchmarkOs) throw new Error("Could not identify the OS release. Select the matching OS version before importing.");
  const benchmarkLabel = benchmark
    ? `${benchmark.getAttribute("id")} ${textOf(benchmark, "title")}`.toLowerCase()
    : "";
  const isStig = /\bdisa\b|\bstig\b|security technical implementation guide/.test(benchmarkLabel);
  const benchmarkId = benchmark ? normalizeIdentifier(benchmark.getAttribute("id")) : "";
  const benchmarkTitle = benchmark ? textOf(benchmark, "title") : "";
  const sourceKey = `${benchmarkOs}::${benchmarkId || benchmarkTitle || fileName}`;
  const parsedRules = descendants(doc, "Rule").map((node) => {
    const id = normalizeIdentifier(node.getAttribute("id"));
    const identifiers = descendants(node, "ident")
      .map((ident) => normalizeIdentifier(ident.textContent))
      .filter(Boolean);
    const extractedIdentifiers = id.match(/\b(?:SV|V)-\d+(?:r\d+)?\b/gi) || [];
    identifiers.push(...extractedIdentifiers);
    const ssgPrefix = "xccdf_org.ssgproject.content_rule_";
    if (id.startsWith(ssgPrefix)) identifiers.unshift(id.slice(ssgPrefix.length));
    const checkContent = descendants(node, "check-content")
      .map((item) => item.textContent.trim())
      .filter(Boolean);
    const checkReferences = descendants(node, "check-content-ref")
      .map((item) => {
        const href = item.getAttribute("href");
        const name = item.getAttribute("name");
        return `Check reference: ${name || "unnamed"}${href ? ` (${href})` : ""}`;
      });
    const checkSystems = Array.from(new Set(descendants(node, "check")
      .map((item) => item.getAttribute("system"))
      .filter(Boolean)))
      .map((system) => `Check system: ${system}`);
    const check = [...checkContent, ...checkReferences, ...checkSystems].join("\n\n");
    const fixText = descendants(node, "fixtext")
      .map((item) => item.textContent.trim())
      .filter(Boolean).join("\n\n");
    const fixScripts = descendants(node, "fix")
      .map((item) => item.textContent.trim())
      .filter(Boolean).join("\n\n");
    const fix = fixText || fixScripts;
    const allText = [
      textOf(node, "title"),
      textOf(node, "description"),
      check,
      fix,
      identifiers.join(" "),
      id
    ].join(" ");

    return {
      key: `${sourceKey}::${id}`,
      os: benchmarkOs,
      sourceKey,
      benchmarkId,
      benchmarkTitle,
      title: textOf(node, "title") || id || "Untitled rule",
      description: textOf(node, "description") || "No description was provided in this rule.",
      severity: classifySeverity(node.getAttribute("severity"), isStig),
      severityRaw: node.getAttribute("severity") || "",
      ids: Array.from(new Set([id, ...identifiers].filter(Boolean))),
      ruleId: id,
      check,
      fix,
      fixScripts,
      source: fileName,
      risk: RISK_TERMS.test(allText),
      demo: false
    };
  });

  if (!parsedRules.length) throw new Error("No XCCDF Rule elements were found in this file.");
  return { os: benchmarkOs, sourceKey, rules: parsedRules, benchmarkTitle };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function severityClass(severity) {
  return severity === "CAT I" ? "cat-i" : severity === "CAT II" ? "cat-ii" : severity === "CAT III" ? "cat-iii" : "";
}

function ruleKey(rule) {
  return rule.key || `${rule.os}::${rule.ruleId}`;
}

function identifierType(identifier, rule) {
  if (/^(?:CCI)-/i.test(identifier)) return "CCI";
  if (/^(?:SV|V)-\d/i.test(identifier)) return "STIG";
  if ((rule.ruleId || "").startsWith("xccdf_org.ssgproject.content_rule_") && identifier === rule.ruleId.slice("xccdf_org.ssgproject.content_rule_".length)) return "SSG";
  if (identifier === rule.ruleId) return "Rule ID";
  return "Identifier";
}

function isRisky(rule) {
  return Boolean(rule.risk) || RISK_TERMS.test(`${rule.title} ${rule.description} ${rule.check} ${rule.fix}`);
}

function findRuleForFinding(report, finding) {
  const targetId = normalizeIdentifier(finding.idref).toLowerCase();
  const matches = rules.filter((rule) => !rule.demo && (
    normalizeIdentifier(rule.ruleId).toLowerCase() === targetId ||
    (rule.ids || []).some((id) => normalizeIdentifier(id).toLowerCase() === targetId)
  ));
  if (report.benchmarkId) return matches.find((rule) => rule.benchmarkId === report.benchmarkId) || null;
  return matches[0] || null;
}

function renderScanStatus() {
  if (!scanReports.length) {
    selectedScanKey = "";
    elements.scanSelect.hidden = true;
    elements.scanSelect.parentElement.hidden = true;
    elements.scanSummary.innerHTML = `<p class="scan-empty">No scan report imported. Current compliance status is unknown; Hardenhelp does not scan hosts.</p>`;
    return;
  }
  const orderedReports = scanReports.slice().sort((a, b) => (b.endTime || b.startTime || "").localeCompare(a.endTime || a.startTime || ""));
  if (!orderedReports.some((report) => report.key === selectedScanKey)) selectedScanKey = orderedReports[0].key;
  elements.scanSelect.hidden = false;
  elements.scanSelect.parentElement.hidden = false;
  elements.scanSelect.innerHTML = orderedReports.map((report) => {
    const label = `${report.target || "Unknown host"} · ${report.endTime || report.startTime || "No timestamp"} · ${report.source}`;
    return `<option value="${escapeHtml(report.key)}">${escapeHtml(label)}</option>`;
  }).join("");
  elements.scanSelect.value = selectedScanKey;
  const report = orderedReports.find((item) => item.key === selectedScanKey) || orderedReports[0];
  const counts = report.findings.reduce((totals, finding) => {
    const result = finding.result || "unknown";
    totals[result] = (totals[result] || 0) + 1;
    return totals;
  }, {});
  const failed = report.findings.filter((finding) => finding.result === "fail");
  const pass = counts.pass || 0;
  const failedSeverity = failed.reduce((totals, finding) => {
    const rule = findRuleForFinding(report, finding);
    const severity = rule ? rule.severity : "Unverified";
    totals[severity] = (totals[severity] || 0) + 1;
    return totals;
  }, {});
  const failuresHtml = failed.length
    ? `<div class="scan-failures"><h3>Failed rules in this report (${failed.length})</h3>${failed.slice(0, 20).map((finding) => {
      const rule = findRuleForFinding(report, finding);
      const title = rule ? rule.title : finding.idref;
      const severity = rule ? `<span class="severity-badge ${severityClass(rule.severity)}">${escapeHtml(rule.severity)}</span>` : `<span class="unmapped-badge">Not in imported library</span>`;
      return `<button type="button" class="scan-finding" data-finding-id="${escapeHtml(finding.idref)}" ${rule ? `data-rule-key="${escapeHtml(ruleKey(rule))}"` : ""}><span class="scan-finding-copy"><span class="scan-finding-title">${escapeHtml(title)}</span><span class="scan-finding-id">${escapeHtml(finding.idref)}</span></span>${severity}</button>`;
    }).join("")}${failed.length > 20 ? `<div class="scan-target">Showing first 20 failed rules.</div>` : ""}</div>`
    : `<div class="scan-failures"><h3>Failed rules</h3><p class="scan-empty">No failed rules were recorded in this report. This alone does not establish current or complete compliance.</p></div>`;
  const meta = [
    report.target ? `Host: ${report.target}` : "Host: not specified",
    report.benchmarkId ? `Benchmark: ${report.benchmarkId}` : "",
    report.profileId ? `Profile: ${report.profileId}` : "",
    report.endTime ? `Completed: ${report.endTime}` : report.startTime ? `Started: ${report.startTime}` : "Scan time: not specified",
    `Source file: ${report.source}`
  ].filter(Boolean);
  const categoryCounts = ["CAT I", "CAT II", "CAT III", "Unverified"]
    .filter((severity) => failedSeverity[severity])
    .map((severity) => `<span class="scan-count${severity === "CAT I" ? " fail" : ""}">${severity} ${failedSeverity[severity]}</span>`)
    .join("");
  const accessGuidance = failed.some((finding) => isRisky(findRuleForFinding(report, finding) || { title: finding.idref }))
    ? `<p class="scan-safe-order">Review CAT I findings first, but do not change SSH, PAM, firewall, or lockout rules over your only management path. Keep console or a second privileged session, test one change at a time, and validate before closing the original session.</p>`
    : "";
  elements.scanSummary.innerHTML = `<div class="scan-summary"><div><div class="scan-summary-head"><span class="scan-status-badge ${failed.length ? "has-failures" : "clean"}">${failed.length ? `${failed.length} failures` : "No recorded failures"}</span><strong>Report snapshot</strong></div><div class="scan-target">${meta.map(escapeHtml).join("<br>")}</div><div class="scan-counts"><span class="scan-count pass">Pass ${pass}</span><span class="scan-count fail">Fail ${failed.length}</span><span class="scan-count">Other ${report.findings.length - pass - failed.length}</span>${categoryCounts}</div>${accessGuidance}<button id="remove-scan-report" class="scan-remove" type="button">Remove this local scan report</button></div>${failuresHtml}</div>`;
}

function filteredRules() {
  const query = elements.search.value.trim().toLowerCase();
  const os = elements.os.value;
  const severity = elements.severity.value;
  return rules.filter((rule) => {
    if (os !== "all" && rule.os !== os) return false;
    if (severity !== "all" && (rule.severity || "Unverified") !== severity) return false;
    if (!query) return true;
    return [
      rule.title, rule.description, rule.ruleId, ...(rule.ids || []),
      rule.os, rule.check, rule.fix, rule.severity
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderList() {
  renderListWithLimit(true);
}

function renderListWithLimit(resetLimit) {
  if (resetLimit) visibleRuleLimit = 100;
  const matches = filteredRules();
  if (selectedRuleKey && !matches.some((rule) => ruleKey(rule) === selectedRuleKey)) {
    selectedRuleKey = "";
    renderDetail(null);
  }
  elements.ruleCount.textContent = String(rules.length);
  elements.resultCount.textContent = `${matches.length} ${matches.length === 1 ? "result" : "results"}`;
  elements.empty.style.display = matches.length ? "none" : "flex";
  if (!matches.length) {
    const noRules = rules.length === 0;
    elements.empty.innerHTML = `<div class="empty-symbol" aria-hidden="true">${noRules ? "⌕" : "↗"}</div><strong>${noRules ? "No benchmark loaded yet" : "No rules match these filters"}</strong><p>${noRules ? "Import an XCCDF XML file to search its rules, identifiers, checks, and remediations." : "Try another identifier, keyword, OS version, or severity."}</p>${noRules ? `<button class="text-button" id="empty-import" type="button">Choose an XCCDF file <span aria-hidden="true">→</span></button>` : `<button class="text-button" id="clear-filters" type="button">Clear search and filters <span aria-hidden="true">→</span></button>`}`;
    const emptyImport = elements.empty.querySelector("#empty-import");
    if (emptyImport) emptyImport.addEventListener("click", () => elements.file.click());
    const clearFilters = elements.empty.querySelector("#clear-filters");
    if (clearFilters) clearFilters.addEventListener("click", () => {
      elements.search.value = "";
      elements.os.value = "all";
      elements.severity.value = "all";
      renderList();
    });
  }
  elements.list.innerHTML = matches.slice(0, visibleRuleLimit).map((rule) => {
    const key = ruleKey(rule);
    const identifiers = (rule.ids || []).filter(Boolean);
    const shownId = identifiers[0] || rule.ruleId || "No mapped identifier";
    return `<button type="button" class="rule-item${selectedRuleKey === key ? " selected" : ""}" data-rule-key="${escapeHtml(key)}">
      <span class="rule-item-top"><span class="rule-os">${escapeHtml(rule.os)}</span><span class="severity-badge ${severityClass(rule.severity)}">${escapeHtml(rule.severity || "Unverified")}</span></span>
      <strong>${escapeHtml(rule.title)}</strong><span class="rule-id">${escapeHtml(shownId)}</span>
    </button>`;
  }).join("");
  const loadMore = document.querySelector("#load-more");
  loadMore.hidden = matches.length <= visibleRuleLimit;
  loadMore.textContent = `Show ${Math.min(100, matches.length - visibleRuleLimit)} more rules (${matches.length - visibleRuleLimit} remaining)`;
  renderComparisonOptions();
}

function renderDetail(rule) {
  if (!rule) {
    elements.detail.innerHTML = `<div class="detail-placeholder"><span class="placeholder-icon" aria-hidden="true"><svg viewBox="0 0 36 36"><path d="M8 5.5h13l7 7V30H8z" /><path d="M21 5.5v7h7M12.5 19h11M12.5 23.5h11" /></svg></span><h3>Select a rule to inspect it</h3><p>Search by any identifier or browse an imported benchmark. Each rule stays tied to the OS version it came from.</p></div>`;
    return;
  }
  const ids = (rule.ids || []).filter(Boolean);
  const risk = isRisky(rule);
  const check = rule.check || "";
  const fix = rule.fix || "";
  const fixScripts = rule.fixScripts || "";
  const ruleIds = new Set(ids.map((id) => normalizeIdentifier(id).toLowerCase()));
  const relatedRules = rules.filter((candidate) => {
    if (candidate === rule || candidate.demo || candidate.os !== rule.os) return false;
    return (candidate.ids || []).some((id) => ruleIds.has(normalizeIdentifier(id).toLowerCase()));
  }).slice(0, 5);
  const riskNotice = risk
    ? `<div class="risk-warning"><span class="risk-symbol" aria-hidden="true">!</span><div><strong>Potential lock-out risk</strong><span>This rule mentions SSH, PAM, firewall, authentication, or account lockout. Preserve a working session, arrange console access, and validate the change before closing your current connection.</span></div></div>`
    : `<div class="risk-warning safe"><span class="risk-symbol" aria-hidden="true">✓</span><div><strong>No obvious remote-access keywords detected</strong><span>This is a keyword warning, not a guarantee that applying the fix is safe.</span></div></div>`;
  elements.detail.innerHTML = `<div class="detail-content">
    <div class="detail-head"><div><div class="detail-kicker">${escapeHtml(rule.os)} · ${escapeHtml(rule.ruleId || "Rule")}</div><h3>${escapeHtml(rule.title)}</h3><div class="detail-source">Benchmark: ${escapeHtml(rule.benchmarkTitle || rule.source || "Imported XCCDF")}</div><div class="detail-source">Source: ${escapeHtml(rule.source || "Imported XCCDF")} · ${escapeHtml(rule.severityRaw ? `Source severity: ${rule.severityRaw}` : rule.severity || "Unverified severity")}</div></div><span class="severity-badge ${severityClass(rule.severity)}">${escapeHtml(rule.severity || "Unverified")}</span></div>
    <section class="detail-section"><h4><span></span>Requirement &amp; why it matters</h4><p>${escapeHtml(rule.description || "No description was provided in this rule.")}</p></section>
    <section class="detail-section"><h4><span></span>Identifier mapping</h4><div class="id-chips">${ids.length ? ids.map((id) => `<span class="id-chip"><small>${identifierType(id, rule)}</small>${escapeHtml(id)}</span>`).join("") : `<span class="id-chip empty">No mapped identifiers in this rule</span>`}</div></section>
    ${relatedRules.length ? `<section class="detail-section"><h4><span></span>Related imported rules · shared ID</h4><div class="related-rules">${relatedRules.map((candidate) => {
      const shared = (candidate.ids || []).find((id) => ruleIds.has(normalizeIdentifier(id).toLowerCase()));
      return `<button type="button" class="related-rule" data-action="select-related" data-rule-key="${escapeHtml(ruleKey(candidate))}"><span>${escapeHtml(candidate.title)}</span><code>${escapeHtml(shared)}</code><small>${escapeHtml(candidate.source || "Imported XCCDF")}</small></button>`;
    }).join("")}</div></section>` : ""}
    <section class="detail-section"><h4><span></span>Check from source</h4>${check ? `<pre class="detail-code">${escapeHtml(check)}</pre>` : `<p class="check-empty">No check-content was included in this rule. Consult the imported benchmark or the matching source.</p>`}</section>
    <section class="detail-section"><h4><span></span>Fix from source · reference only</h4>${fix ? `<pre class="detail-code">${escapeHtml(fix)}</pre>` : `<p class="fix-empty">No fix or fixtext was included in this rule.</p>`}${fixScripts && fixScripts !== fix ? `<div class="detail-subhead">Remediation content</div><pre class="detail-code">${escapeHtml(fixScripts)}</pre>` : ""}</section>
    ${riskNotice}
    ${rule.demo ? `<div class="demo-note">Preview data only. It has no official STIG/SSG IDs or verified severity and must not be used as audit evidence. Import your exact release to see its source content.</div>` : ""}
    <div class="source-actions"><a href="https://public.cyber.mil/stigs/downloads/" target="_blank" rel="noreferrer">Official STIG downloads ↗</a>${rule.demo ? "" : `<button type="button" data-action="remove-rule" data-rule-key="${escapeHtml(ruleKey(rule))}">Remove imported rule</button><button type="button" data-action="remove-benchmark" data-source-key="${escapeHtml(rule.sourceKey)}">Remove benchmark</button>`}</div>
  </div>`;
}

function renderComparisonOptions() {
  const benchmarks = new Map();
  rules.filter((rule) => !rule.demo && rule.sourceKey).forEach((rule) => {
    if (!benchmarks.has(rule.sourceKey)) {
      benchmarks.set(rule.sourceKey, {
        key: rule.sourceKey,
        label: `${rule.os} · ${rule.benchmarkTitle || rule.source || "Imported benchmark"}`
      });
    }
  });
  const importedBenchmarks = Array.from(benchmarks.values()).sort((a, b) => a.label.localeCompare(b.label));
  [elements.compareA, elements.compareB].forEach((select) => {
    const previous = select.value;
    const placeholder = select.id === "compare-a" ? "Select first benchmark" : "Select second benchmark";
    select.innerHTML = `<option value="">${placeholder}</option>${importedBenchmarks.map((benchmark) => `<option value="${escapeHtml(benchmark.key)}">${escapeHtml(benchmark.label)}</option>`).join("")}`;
    if (benchmarks.has(previous)) select.value = previous;
  });
}

function compareReleases() {
  const first = elements.compareA.value;
  const second = elements.compareB.value;
  if (!first || !second || first === second) {
    elements.compareOutput.textContent = "Select two different imported benchmarks to compare.";
    return;
  }
  const left = rules.filter((rule) => rule.sourceKey === first && !rule.demo);
  const right = rules.filter((rule) => rule.sourceKey === second && !rule.demo);
  const firstLabel = `${left[0].os} · ${left[0].benchmarkTitle || left[0].source}`;
  const secondLabel = `${right[0].os} · ${right[0].benchmarkTitle || right[0].source}`;
  const rightIndex = new Map();
  right.forEach((rule) => {
    (rule.ids || []).filter(Boolean).forEach((id) => {
      const normalized = normalizeIdentifier(id).toLowerCase();
      if (!rightIndex.has(normalized)) rightIndex.set(normalized, rule);
    });
  });
  const matches = [];
  left.forEach((rule) => {
    const counterpart = (rule.ids || []).map((id) => rightIndex.get(normalizeIdentifier(id).toLowerCase())).find(Boolean);
    if (counterpart) matches.push({ left: rule, right: counterpart });
  });
  const unmatched = left.length - matches.length;
  elements.compareOutput.innerHTML = `<div class="compare-result"><span class="match-count">${matches.length} shared-ID match${matches.length === 1 ? "" : "es"}</span><span class="compare-detail">${unmatched} rule${unmatched === 1 ? "" : "s"} in ${escapeHtml(firstLabel)} had no exact shared-ID match in ${escapeHtml(secondLabel)}.</span></div>${matches.slice(0, 5).map(({ left: a, right: b }) => `<div class="compare-detail" style="margin-top:5px">${escapeHtml(a.title)} ↔ ${escapeHtml(b.title)} <span class="id-chip">${escapeHtml((a.ids || []).find((id) => (b.ids || []).includes(id) || (b.ids || []).some((candidate) => candidate.toLowerCase() === id.toLowerCase())) || "")}</span></div>`).join("")}`;
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4200);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

async function handleImport(files) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  const failures = [];
  let latestImport = null;
  const importedBySource = new Map();
  let saved = true;
  for (const file of selectedFiles) {
    try {
      const parsed = parseXccdf(await readFile(file), elements.os.value, file.name);
      rules = rules.filter((rule) => !rule.demo && rule.sourceKey !== parsed.sourceKey).concat(parsed.rules);
      latestImport = parsed;
      importedBySource.set(parsed.sourceKey, parsed.rules.length);
    } catch (error) {
      console.error(`XCCDF import failed for ${file.name}.`, error);
      failures.push(`${file.name}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }
  if (latestImport) {
    saved = await persistRules();
    elements.os.value = latestImport.os;
    elements.search.value = "";
    elements.severity.value = "all";
    selectedRuleKey = latestImport.rules.length ? ruleKey(latestImport.rules[0]) : "";
    renderList();
    renderDetail(latestImport.rules[0] || null);
  }
  const importedRules = Array.from(importedBySource.values()).reduce((sum, count) => sum + count, 0);
  const importedFiles = importedBySource.size;
  const summary = latestImport
    ? `Imported ${importedRules} rules from ${importedFiles} benchmark file${importedFiles === 1 ? "" : "s"}.${failures.length ? ` ${failures.length} file${failures.length === 1 ? "" : "s"} failed: ${failures.slice(0, 2).join("; ")}` : " Confirm the OS, release, and profile before using them."}${saved ? "" : " Import is available only for this session because browser storage failed."}`
    : failures.slice(0, 2).join("; ") || "No benchmark files were selected.";
  showToast(summary);
  elements.file.value = "";
}

async function handleScanImport(files) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  const failures = [];
  let imported = 0;
  for (const file of selectedFiles) {
    try {
      const parsedReports = parseScanResults(await readFile(file), file.name);
      scanReports = scanReports.filter((report) => !parsedReports.some((parsed) => parsed.key === report.key)).concat(parsedReports);
      selectedScanKey = parsedReports[parsedReports.length - 1].key;
      imported += parsedReports.length;
    } catch (error) {
      console.error(`Scan report import failed for ${file.name}.`, error);
      failures.push(`${file.name}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }
  if (imported) {
    const saved = await persistScanReports();
    renderScanStatus();
    showToast(`Loaded ${imported} scan result${imported === 1 ? "" : "s"}${failures.length ? `; ${failures.length} file${failures.length === 1 ? "" : "s"} failed: ${failures.slice(0, 2).join("; ")}` : saved ? ". Review the target and timestamp; this is not live status." : ". The report could not be saved in this browser."}`);
  } else {
    showToast(failures.slice(0, 2).join("; ") || "No scan report files were selected.");
  }
  elements.scanFile.value = "";
}

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rule-key]");
  if (!button) return;
  const rule = rules.find((item) => ruleKey(item) === button.dataset.ruleKey);
  if (!rule) return;
  selectedRuleKey = ruleKey(rule);
  renderListWithLimit(false);
  renderDetail(rule);
});

elements.detail.addEventListener("click", async (event) => {
  const related = event.target.closest('[data-action="select-related"]');
  if (related) {
    const rule = rules.find((item) => ruleKey(item) === related.dataset.ruleKey);
    if (!rule) return;
    elements.os.value = "all";
    elements.search.value = "";
    elements.severity.value = "all";
    selectedRuleKey = ruleKey(rule);
    renderListWithLimit(false);
    renderDetail(rule);
    return;
  }
  const remove = event.target.closest('[data-action="remove-rule"]');
  if (remove) {
    const rule = rules.find((item) => ruleKey(item) === remove.dataset.ruleKey);
    if (!rule || rule.demo) return;
    rules = rules.filter((item) => ruleKey(item) !== ruleKey(rule));
    const saved = await persistRules();
    selectedRuleKey = "";
    renderList();
    renderDetail(null);
    showToast(saved ? "Removed the selected rule from this browser." : "Removed this rule for the session, but could not save the change.");
    return;
  }
  const removeBenchmark = event.target.closest('[data-action="remove-benchmark"]');
  if (!removeBenchmark) return;
  const sourceKey = removeBenchmark.dataset.sourceKey;
  if (!sourceKey) return;
  const removedCount = rules.filter((item) => item.sourceKey === sourceKey).length;
  rules = rules.filter((item) => item.sourceKey !== sourceKey);
  const saved = await persistRules();
  selectedRuleKey = "";
  renderList();
  renderDetail(null);
  showToast(saved
    ? `Removed benchmark and ${removedCount} rule${removedCount === 1 ? "" : "s"} from this browser.`
    : `Removed the benchmark for this session, but could not save the change.`);
});

elements.scanSummary.addEventListener("click", async (event) => {
  const findingButton = event.target.closest("[data-finding-id]");
  if (findingButton) {
    const rule = rules.find((item) => ruleKey(item) === findingButton.dataset.ruleKey);
    elements.os.value = rule ? rule.os : "all";
    elements.search.value = rule ? "" : findingButton.dataset.findingId;
    elements.severity.value = "all";
    selectedRuleKey = rule ? ruleKey(rule) : "";
    renderList();
    if (rule) renderDetail(rule);
    return;
  }
  if (!event.target.closest("#remove-scan-report")) return;
  scanReports = scanReports.filter((report) => report.key !== selectedScanKey);
  selectedScanKey = "";
  const saved = await persistScanReports();
  renderScanStatus();
  showToast(saved ? "Removed local scan report." : "Removed the report for this session, but could not save the change.");
});

elements.search.addEventListener("input", renderList);
elements.os.addEventListener("change", renderList);
elements.severity.addEventListener("change", renderList);
document.querySelector("#import-button").addEventListener("click", () => elements.file.click());
document.querySelector("#empty-import").addEventListener("click", () => elements.file.click());
elements.file.addEventListener("change", (event) => handleImport(event.target.files));
document.querySelector("#compare-button").addEventListener("click", compareReleases);
document.querySelector("#scan-import-button").addEventListener("click", () => elements.scanFile.click());
elements.scanFile.addEventListener("change", (event) => handleScanImport(event.target.files));
elements.scanSelect.addEventListener("change", () => {
  selectedScanKey = elements.scanSelect.value;
  renderScanStatus();
});
document.querySelector("#load-more").addEventListener("click", () => {
  visibleRuleLimit += 100;
  renderListWithLimit(false);
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
  }
});

async function initialize() {
  try {
    const savedRules = await loadRules();
    if (savedRules) rules = savedRules;
  } catch (error) {
    console.error("Could not load local rule library.", error);
    showToast("Saved rules could not be read. Import a benchmark to continue.");
  }
  try {
    scanReports = await loadScanReports();
  } catch (error) {
    console.error("Could not load local scan reports.", error);
    showToast("Saved scan reports could not be read in this browser.");
  }
  renderList();
  renderDetail(null);
  renderScanStatus();
}

initialize();
