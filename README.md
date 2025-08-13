# medusa-plugin-keygen

Medusa v2 plugin that creates **licenses via keygen.sh** when an order is placed.
Includes **admin widgets** (product & variant) and **admin server routes** (validation, policy management).

## Features

- **Subscriber**: listens for `order.placed` and creates a license for each line item
- **Data Model**: `keygen_license` table (order_id, license_id, key, status, etc.)
- **Admin Widgets**:
  - Product: set `keygen_product` / `keygen_policy`, view/create/clone policies, select entitlements
  - Variant: set metadata per variant (override)
- **Admin API**:
  - `POST /admin/keygen/validate`
  - `GET /admin/keygen/policies?productId=`
  - `POST /admin/keygen/policies` (including entitlements)
  - `POST /admin/keygen/policies/clone`
  - `GET /admin/keygen/entitlements`

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
```

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
