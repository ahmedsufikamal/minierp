# Trade Finance LC Permissions

## Permission Keys

- `trade.lc.read`
- `trade.lc.write`
- `trade.lc.approve`
- `trade.lc.issue`
- `trade.lc.settle`
- `trade.lc.admin`

## Runtime Aliases

To avoid locking out existing tenants before RBAC profiles are updated, the LC auth wrapper accepts fallback aliases:

- `trade.lc.read` also accepts `finance.read` or `accounting.report.read`
- `trade.lc.write` also accepts `finance.write`
- `trade.lc.approve` also accepts `finance.write`
- `trade.lc.issue` also accepts `finance.write`
- `trade.lc.settle` also accepts `finance.write`
- `trade.lc.admin` also accepts `admin.settings`

## Access Matrix

- Dashboard/Register/Record/Reports: `trade.lc.read`
- Create/Edit Draft: `trade.lc.write`
- Submit: `trade.lc.write`
- Approve: `trade.lc.approve`
- Issue/Cancel: `trade.lc.issue`
- Close: `trade.lc.settle`
- Settings + Masters: `trade.lc.admin`

## Server Enforcement

- Every route handler is wrapped with `withTradeAuth`.
- Every page is guarded with `requireTradePermissionPage`.
- Workflow transitions are validated again inside the service layer, even if buttons are hidden in the UI.
