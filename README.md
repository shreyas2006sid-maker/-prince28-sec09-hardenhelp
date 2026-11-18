# Hardenhelp

A local-first, reference-only rule explorer for DISA STIG and SCAP Security Guide XCCDF benchmarks. It is designed to help administrators inspect what an individual rule checks, why it matters, which identifiers the source associates with it, and what remediation text the source provides.

## Run it

Open `index.html` in a modern browser. No build step or dependency installation is required. Imported rule details are stored in that browser's IndexedDB; the XML file itself is not uploaded.

## Import a benchmark

1. Download the exact XCCDF XML release for the target OS from the official source.
2. Use **Import benchmark** to choose one or more extracted XCCDF XML files. The app attempts to identify Ubuntu 22.04/24.04, RHEL 9, or Windows Server 2022 from each benchmark's metadata. Extract downloaded STIG ZIP files first.
3. If the OS release cannot be identified, select the matching release in the explorer and import again. Always confirm the displayed OS and benchmark title against the source file.
4. Search by rule ID, `ident` value (for example CCI), SSG rule name, or words in the rule. You can import more than one file for the same OS; records from separate benchmarks remain source-specific and link to one another when an identifier matches exactly.

The importer reads XCCDF `<Rule>`, `<ident>`, `<check-content>`, `<check-content-ref>`, `<fixtext>`, and `<fix>` elements, including namespaced XML. OVAL check references are displayed as references, not interpreted as shell commands. Re-importing the same benchmark (matching its OS and benchmark ID) replaces its previous records; distinct benchmark releases remain available for comparison. It does not evaluate OVAL checks, resolve profiles or tailoring, translate between different identifiers without a shared ID, execute commands, or inspect a server.

Use **Import scan report** for one or more XCCDF `TestResult` XML reports. Select between imported hosts/reports to review the host, benchmark, profile, timestamp, pass/fail counts, and failed rule IDs. Hardenhelp matches results to imported rules by exact rule/identifier IDs and, when provided, the exact benchmark ID. A report is only evidence from its recorded time and does not establish current or complete compliance.

Explicit CAT values are retained. For a benchmark identified as DISA/STIG, source `high`/`medium`/`low` severity is displayed as CAT I/II/III; for other benchmarks these values remain unverified. A blank check or fix means that content was not present in the imported rule fields; consult the source benchmark.

## Safety and scope

- The three built-in Ubuntu entries are illustrative UI previews, not official rules. They intentionally have no STIG/SSG IDs or asserted CAT severity.
- Imported checks and remediations are displayed as supplied by the XML. Treat them as review material, not commands approved for production.
- The lock-out badge uses keyword detection for SSH, PAM, firewall, authentication, and account-lockout topics. It is a warning aid, not a safety proof.
- The comparison view only reports exact matches on shared identifier strings. It does not infer that differently identified rules are equivalent.
- Hardenhelp cannot determine whether a production host is compliant. Use an authorized OpenSCAP scan and review its results against the correct benchmark/profile and host.
- Before applying remote-access, PAM, firewall, or account-lockout changes, retain a working session and arrange console or out-of-band recovery access. Test staged changes on a representative system first.

## Data sources and licensing

- [DISA STIG downloads](https://public.cyber.mil/stigs/downloads/)
- [NIST National Checklist Program repository](https://ncp.nist.gov/repository)
- [ComplianceAsCode/content](https://github.com/ComplianceAsCode/content) — review the repository's [BSD-3-Clause LICENSE](https://github.com/ComplianceAsCode/content/blob/master/LICENSE) and notices for the exact release and files you use.
- [OpenSCAP documentation and project](https://www.open-scap.org/)

The starter project does not include official benchmark datasets; the bundled preview rules and XML fixtures are synthetic and for UI testing only. Obtain release files from their source, retain version/provenance information, and check the applicable notices and terms before redistribution.

## Project documents

- [Discovery questions](docs/QUESTIONS.md)
- [Software requirements](docs/REQUIREMENTS.md)
- [Python and quality-tool configuration](pyproject.toml)
- [Pre-commit configuration](.pre-commit-config.yaml)
- [Environment template](.env.example)

Hardenhelp itself is a dependency-free browser application. The Python configuration and pre-commit hooks are optional repository tooling for documentation and XML validation workflows; they do not add a server or transmit imported data.
