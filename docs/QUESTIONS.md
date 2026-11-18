# Hardenhelp Discovery Questions

## Status

The core MVP requirements are defined below. Responses marked **Decision** record the
assumptions used for implementation.

## User and objective

1. **Who is the primary user?**  
   Decision: Junior system administrators working on Linux or Windows hardening.

2. **What operating systems must the MVP support?**  
   Decision: Ubuntu 22.04, Ubuntu 24.04, RHEL 9, and Windows Server 2022.

3. **What problem does the application solve?**  
   Decision: It explains the source benchmark, identifiers, severity, check content,
   remediation content, and remote-access risks for a selected rule.

## Data and provenance

4. **Which benchmark sources may be used?**  
   Decision: XCCDF XML from DISA STIG releases and ComplianceAsCode SCAP Security Guide.

5. **May official benchmark data be bundled?**  
   Decision: No for this MVP. Users import exact release files, and synthetic XML fixtures
   are retained only for UI testing.

6. **How must source provenance be shown?**  
   Decision: Display the source file, benchmark title, benchmark ID, OS release, and
   source severity when available.

## Search and mapping

7. **How are rules matched across releases?**  
   Decision: Only exact normalized identifiers or rule IDs are matched. Titles and
   descriptions are never used to infer equivalence.

8. **Which identifiers must be searchable?**  
   Decision: Rule ID, SV/V ID, CCI, SSG rule name, and words in rule text.

9. **What must happen for unsupported identifier mappings?**  
   Decision: Show "no exact mapped identifier" or "not in imported library"; do not
   invent a mapping.

## Safety

10. **May Hardenhelp execute checks or remediations?**  
    Decision: No. It is reference-only and does not connect to or inspect a server.

11. **How should remote-access changes be presented?**  
    Decision: Use a lock-out warning for SSH, PAM, firewall, authentication, account
    lockout, root-login, and remote-access keywords. The warning is advisory, not a
    safety guarantee.

12. **May the app establish live compliance?**  
    Decision: No. Imported XCCDF scan reports are dated evidence snapshots only.

## Data handling

13. **How must imported data be stored?**  
    Decision: Store benchmark and report records locally in IndexedDB in the browser.

14. **Is an account or backend required?**  
    Decision: No. The MVP must work as a static browser application.
