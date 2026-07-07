# security_module (SIMS)

Security Incident Management System for the Department of Land Reform and Rural Development (DLRRD), South Africa. React + Vite frontend (`src/`), Node/TS server (`server/`), SQLite locally (`security.db`) / Azure SQL in production (`database_mssql.sql`).

## Domain knowledge — important

Before implementing new features or changing existing screens, forms, schema, roles, reports, or workflows, consult the **`dlrrd-domain` skill** (`.claude/skills/dlrrd-domain/`). It contains the extracted, readable versions of the client's requirement documents in `docs/` (BRS functional requirements, official incident types, register columns, performance indicators, SLA/policy deadlines, provincial data-segregation rules). The `docs/` files themselves are binary (.docx/.xlsx) — use the skill's references instead of trying to read them.

Key invariants: provincial data segregation, AD SSO only, immutable audit trail, POPIA compliance, SA financial year (Apr–Mar), 9 canonical province names.
