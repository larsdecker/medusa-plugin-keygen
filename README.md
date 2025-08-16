
# medusa-plugin-keygen

Medusa v2 plugin that creates **licenses via keygen.sh** when an order is placed.
Includes **admin widgets** (product & variant) and **admin server routes** (validation, policy management).

## Features
- **Subscriber**: listens for `order.placed` (creates a license for each line item),
  `order.canceled` (suspends licenses) and `order.refunded` (revokes licenses)
- **Data Model**: `keygen_license` table (order_id, license_id, key, status, etc.)
- **Status values**: `created` (active), `suspended` (after cancellation),
  `revoked` (after refund)
- **Admin Widgets**:
  - Product: set `keygen_product` / `keygen_policy`, view/create/clone policies, select entitlements
  - Variant: set metadata per variant (override)
- **Admin API**:
  - `POST /admin/keygen/validate`
  - `GET /admin/keygen/policies?productId=`
  - `POST /admin/keygen/policies` (including entitlements)
  - `POST /admin/keygen/policies/clone`
  - `GET /admin/keygen/entitlements`
  - `GET/POST /admin/keygen/licenses/:order_id`
- Keygen requests include automatic retry logic (up to three attempts on 5xx errors)

- **Store API**:
  - `GET /store/me/licenses` – list licenses for the authenticated customer
    - supports `limit`, `offset`, `q` and `order` query parameters for pagination and sorting
    - when paginated the response contains `{ licenses, count, limit, offset }`
  - `GET /store/me/licenses/:license_id` – retrieve details for a specific license
  - `POST /store/me/licenses/:license_id/download` – create a temporary download link for a Keygen asset
- Example paginated response:
  ```json
  {
    "licenses": [
      { "id": "lic_123", "key": "XXXX-YYYY", "status": "active" }
    ],
    "count": 65,
    "limit": 20,
    "offset": 0
  }
  ```
- **Download link caching**: the Keygen service caches generated download links until they expire to reduce redundant requests
- **Strict TypeScript types**: license APIs and the Keygen service expose tightened TypeScript interfaces so request and response shapes are fully typed

The licenses endpoint lets you fetch existing licenses for an order or manually
generate them if needed.

## KeygenService API
The plugin registers a `keygenService` on the Medusa container. It provides helpers for common licensing operations:

- `createLicense(input)` – create a license in Keygen and persist it locally
- `suspendLicense(licenseId)` – suspend an existing license
- `revokeLicense(licenseId)` – revoke a license permanently
- `getLicenseWithMachines(licenseId)` – retrieve a license along with its machines
- `activateMachine(input)` – attach a machine to a license, enforcing seat limits
- `deleteMachine(machineId)` – remove a machine from Keygen
- `createDownloadLink(input)` – generate and cache a temporary asset download URL

## Installation
```bash
npm i medusa-plugin-keygen
```

Register in `medusa-config.ts`:
```ts
import { defineConfig } from "@medusajs/medusa"

export default defineConfig({
  plugins: [
    {
      resolve: "medusa-plugin-keygen",
      options: {
        policyMetadataKey: "keygen_policy",
        productMetadataKey: "keygen_product",
        // defaultPolicyId: "pol_123",
        // defaultProductId: "prod_123",
        timeoutMs: 12000,
      },
    },
  ],
})
```

Set the environment variables in your app:
```
KEYGEN_ACCOUNT=your-account-or-slug
KEYGEN_TOKEN=your-api-token
# optional: base URL for self-hosted Keygen
# defaults to https://api.keygen.sh
KEYGEN_HOST=https://keygen.example.com
```


A `.env.example` file is included with placeholder values for these variables.

### Self-hosted example

If you host Keygen yourself, point the plugin to your instance by setting
`KEYGEN_HOST` to your base URL. For example:

```bash
KEYGEN_HOST=https://licenses.mycompany.com
```

The plugin will then call your self-hosted API instead of the default
`https://api.keygen.sh`.

Migrations:
```bash
npx medusa plugin:db:generate  # inside the plugin (optional)
npx medusa db:migrate         # in your app (runs plugin migrations)
```

## Admin
- Product detail page: set/validate IDs, create/clone policies, attach entitlements
- Variant view: set metadata per variant

## Tests
```bash
npm i
npm run build
npm test
```

## Use from GitHub
- Create a repo (e.g., `YOUR_ORG/medusa-plugin-keygen`) and push the files
- Bump the version (SemVer), tag it (e.g., `v0.1.0`)
- Optional: GitHub release / npm publish

## License
MIT
