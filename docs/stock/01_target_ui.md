# Stock Module Target UI Spec

## Route map
- Canonical:
  - `/stock` -> Stock Workspace (home)
  - `/stock/items` -> ERP list view
  - `/stock/settings` -> ERP settings shell (tabs + meta + comments/activity)
- Compatibility:
  - `/stock/overview` -> redirect to `/stock`

## 1) `/stock` Stock Workspace
### Section order (desktop + mobile)
1. Header row:
   - Title: `Stock`
   - Subtitle: workspace summary
2. KPI cards row:
   - `Total Stock Value`
   - `Total Warehouses`
   - `Total Active Items`
3. Warehouse-wise Stock Value card:
   - bar chart
   - last synced timestamp
   - filter icon + overflow icon (no-op acceptable)
4. Quick Access row:
   - Item, Delivery Note, Material Request, Purchase Receipt, Stock Ledger, Stock Balance
5. Masters & Reports grouped grid:
   - Items Catalogue
   - Stock Transactions
   - Stock Reports
   - Settings
   - Serial No and Batch
   - Tools
   - Key Reports
   - Other Reports

### UX constraints
- Theme-token-based styling only.
- Responsive behavior:
  - Desktop: multi-column grid
  - Mobile: stacked cards/sections
- Loading state:
  - skeletons for KPI and chart card
- Empty state:
  - chart empty message if no series

## 2) `/stock/items` ERP list view
### Layout
- Top header actions:
  - `List View` selector
  - refresh icon button
  - overflow menu
  - `+ Add Item` CTA
- Main split:
  - Left: filter sidebar
  - Right: list table panel

### Sidebar fields
- Filter By:
  - Assigned To
  - Created By
- Tags:
  - tags input/dropdown
  - `Show Tags` toggle
- Save Filter:
  - filter name
  - save button (stub acceptable)

### Table controls and filters
- Top right controls:
  - count chip (`20 of 54`)
  - sort selector (`Last Updated On`)
- Filter chips row:
  - ID
  - Item Name
  - Item Group
  - Has Variants
  - Variant Of
  - Filters button + count
  - clear button

### Table columns
- Item Name
- Status (Enabled/Disabled/Template pill)
- Item Group
- Item Code
- ID
- row action icon column (comment/favorite placeholders accepted)

### Behavior
- Debounced query search.
- URL query source of truth:
  - `page,page_size,query,item_group,has_variants,variant_of,assigned_to,created_by,tags,sort`
- Pagination:
  - numbered pagination + page-size selector (`20/100/500/2500`)
- States:
  - loading, empty, error

## 3) `/stock/settings` ERP shell
### 3-column composition
- Left rail:
  - Assigned To
  - Attachments
  - Share
- Center:
  - existing stock settings tabs + form fields
- Right:
  - Comments stream (persistent)
  - Activity timeline (audit + comment events)

### Tabs (unchanged functional set)
- Defaults
- Stock Validations
- Stock Reservation
- Serial & Batch Item
- Stock Planning
- Stock Closing

### Behavior
- Read for any authenticated member.
- Edit only for level `>=4`.
- Preserve current save flow:
  - PATCH with optimistic concurrency (`If-Match`/version)
- Dirty-state guard retained.

## Visual fidelity target
- Match ERPNext-like density and grouping while preserving miniERP theme system.
- No visual regressions in light/dark/system.
