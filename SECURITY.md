# Security policy

FootClubSim is in early design stage. There is no released playable version yet.

## Reporting

Report security issues privately to the repository owner using GitHub's private vulnerability reporting when available, rather than posting exploitable details in a public issue. If private reporting is not configured, request a private reporting channel without disclosing the vulnerability.

Do not publish keys, private saves, sensitive personal data, exploit payloads or unlicensed datasets in issues or pull requests.

## Current security priorities

- Local career data and imported files are untrusted; impose size/shape/reference limits and safe migrations.
- No mandatory game backend; local simulation cannot accidentally require an OCI service.
- Do not ship a scraper or unlicensed real-world player database.
- Keep workflows least-privilege, pin externally sourced actions to full immutable SHAs, and avoid secrets in untrusted PR jobs.
- Never weaken deterministic game-state validation or corrupt a save silently on parsing errors.

More detailed threat modeling is required if accounts, remote sync, third-party credentials or cloud APIs are introduced.
