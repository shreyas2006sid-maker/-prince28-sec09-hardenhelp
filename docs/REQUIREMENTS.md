# Hardenhelp Software Requirements

## 1. Purpose

Hardenhelp is a local-first, reference-only tool for browsing XCCDF benchmark rules and
dated OpenSCAP scan reports. It helps junior administrators understand hardening
requirements without executing commands or representing benchmark data as live evidence.

## 2. Functional requirements

### FR-1 Rule import

- Import one or more extracted XCCDF XML files.
- Parse namespaced and non-namespaced XCCDF elements.
- Import `Rule`, `ident`, `check-content`, `check-content-ref`, `fixtext`, and `fix`.
- Identify Ubuntu 22.04, Ubuntu 24.04, RHEL 9, and Windows Server 2022 where metadata
  permits; otherwise allow the user to select a supported OS before import.
- Reject malformed XML and files with no `Rule` elements.
- Replace records for the same OS and benchmark ID, while preserving distinct benchmark
  releases.

### FR-2 Rule exploration

- Search by rule ID, SV/V ID, CCI, SSG rule name, OS, and rule text.
- Filter by OS and normalized severity.
- Show source title, description, identifiers, check content, fix content, source
  severity, and file provenance.
- Paginate long rule lists.
- Select and inspect one rule at a time.

### FR-3 Identifier mapping

- Add exact XCCDF rule IDs and `<ident>` values to each imported rule.
- Extract an SSG rule name from `xccdf_org.ssgproject.content_rule_...` IDs.
- Display the identifier type where it can be inferred.
- Link rules across imported benchmarks only by exact normalized shared IDs.

### FR-4 Severity

- Preserve source severity text.
- Map DISA/STIG `high`, `medium`, and `low` to CAT I, CAT II, and CAT III.
- Retain explicit CAT values.
- Display other benchmark severities as unverified unless a supported explicit CAT value
  is present.

### FR-5 Lock-out warnings

- Detect SSH, PAM, firewall, authentication, account-lockout, root-login, password
  policy, and remote-access terms.
- Show a prominent advisory before remediation content.
- State that the warning is keyword-based and is not a safety proof.

### FR-6 Benchmark comparison

- Select two distinct imported benchmark source keys.
- Report exact shared-ID matches.
- Report unmatched rules without inferring equivalence.
- Limit displayed comparison details to a concise set.

### FR-7 Scan report import

- Import one or more XCCDF `TestResult` XML reports.
- Record target host, benchmark ID, profile ID, start/end time, source file, and
  rule-result entries.
- Match failed findings to imported rules by exact rule ID or identifier and, when
  available, benchmark ID.
- Show pass/fail/other counts and failed-rule severity counts.
- Mark findings not present in the imported library explicitly.

### FR-8 Local persistence

- Store imported benchmarks and scan reports in browser IndexedDB.
- Continue working for the current session if IndexedDB is unavailable.
- Allow removal of an individual rule or complete benchmark.
- Allow removal of an imported scan report.

## 3. Non-functional requirements

### NFR-1 Privacy

- Import and storage are local to the browser.
- The application must not upload benchmark XML or scan reports.
- The application must not execute remediation or shell commands.

### NFR-2 Safety

- Remediation content is review material only.
- Live production compliance must not be asserted.
- Remote-access changes must include a recovery-access warning.

### NFR-3 Usability

- The interface must be usable in a modern browser at desktop and responsive widths.
- Search and filter controls must be keyboard accessible.
- Status messages must clearly distinguish import success, partial failure, and storage
  failure.

### NFR-4 Reliability

- Malformed or unsupported XML must produce a user-visible error without corrupting
  existing imported data.
- Re-importing a source must not duplicate source records.

### NFR-5 Provenance

- A rule must remain tied to its source file and benchmark.
- No official-data licensing or accuracy claim may be inferred from synthetic fixtures.

## 4. Acceptance criteria

- Namespaced Ubuntu, RHEL, and DISA-style fixture imports parse correctly.
- CCI and SV/V identifiers are searchable and displayed.
- Exact shared-ID comparison does not report title-only matches.
- DISA medium/high/low severities map to CAT II/I/III.
- SSH or PAM findings display a lock-out warning.
- Imported scan reports show host, benchmark, profile, timestamp, and failed IDs.
- A fresh browser install starts with synthetic previews and no persisted official data.
- JavaScript syntax checks pass and fixture-based browser imports complete without
  uncaught exceptions.
