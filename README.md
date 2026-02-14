# Stacks Refill

**Pay for subscriptions & bills with crypto on Stacks.**

Stacks Refill lets users pay for everyday services — airtime, data, TV subscriptions, electricity, education PINs — using STX, sBTC, or USDCx. Nigeria is the launch market (MVP), with a pluggable aggregator architecture designed for global expansion.

## How It Works

1. User connects a Stacks wallet (Leather / Xverse via **Stacks Connect**)
2. Selects a service, provider, plan/amount, and enters the recipient
3. The app fetches live crypto-to-local-currency prices from **CoinGecko**
4. On submit the server returns **HTTP 402** with payment requirements
5. The wallet signs and broadcasts the transaction on-chain
6. The server verifies the transaction via the **Hiro Stacks API**, then calls the appropriate aggregator (e.g. **VTPass**) to deliver the service

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) · TypeScript · Bun |
| UI | shadcn/ui · Tailwind CSS v4 |
| Wallet | [@stacks/connect](https://docs.stacks.co/reference/stacks.js/stacks-connect) · [@stacks/transactions](https://github.com/hirosystems/stacks.js) |
| Payments | [x402-stacks](https://www.npmjs.com/package/x402-stacks) · on-chain verification via Hiro API |
| Fulfilment | Pluggable aggregator layer — VTPass (Nigeria MVP) |
| Price Feed | [CoinGecko API](https://docs.coingecko.com/) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- VTPass account (sandbox or live) — [Create one](https://sandbox.vtpass.com/register)
- CoinGecko API key (free demo) — [Get one](https://www.coingecko.com/en/api)
- A Stacks wallet address to receive payments

### Setup

```bash
git clone <repo-url>
cd stacks-refill
bun install

cp .env.example .env.local
# Fill in your keys (see table below)

bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `STACKS_ADDRESS` | Your Stacks mainnet address (SP…) |
| `FACILITATOR_URL` | x402 facilitator endpoint |
| `NETWORK` / `NEXT_PUBLIC_NETWORK` | `mainnet` or `testnet` |
| `COINGECKO_API_KEY` | CoinGecko demo API key |
| `VTPASS_API_KEY` | VTPass API key |
| `VTPASS_SECRET_KEY` | VTPass secret key (POST requests) |
| `VTPASS_PUBLIC_KEY` | VTPass public key (GET requests) |
| `VTPASS_BASE_URL` | `https://sandbox.vtpass.com/api` or `https://vtpass.com/api` |

## API Endpoints

### `GET /api/services?country=NG`

Returns the service catalogue split into **available** and **comingSoon**, with providers for each available service.

### `GET /api/prices`

Returns live STX, sBTC, USDCx prices in NGN.

### `GET /api/plans?serviceID=mtn-data&serviceType=data&country=NG`

Returns plan variations for a provider + service type.

### `POST /api/purchase`

Payment-gated purchase endpoint.

**Request body:**

```json
{
  "serviceType": "airtime",
  "serviceID": "mtn",
  "recipient": "08012345678",
  "amount": 500,
  "cryptoType": "STX",
  "country": "NG"
}
```

The endpoint returns HTTP 402 with payment requirements. After the wallet signs and the client retries with `x-payment-txid`, the server verifies on-chain and fulfils via the aggregator.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── plans/route.ts         # GET plan variations (aggregator-backed)
│   │   ├── prices/route.ts        # GET crypto prices in local currency
│   │   ├── purchase/route.ts      # POST payment-gated purchase
│   │   └── services/route.ts      # GET service catalogue
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                   # Service grid + purchase UI
│   └── providers.tsx              # Client providers (WalletProvider)
├── components/ui/                 # shadcn/ui primitives
└── lib/
    ├── aggregators/               # ⭐ Pluggable service aggregators
    │   ├── types.ts               #   Core interfaces (Aggregator, ServiceType, etc.)
    │   ├── vtpass.ts              #   VTPass implementation (Nigeria)
    │   ├── registry.ts            #   Service catalogue + aggregator lookup
    │   └── index.ts               #   Re-exports
    ├── coingecko.ts               # CoinGecko price feed (60 s cache)
    ├── stacks-wallet.tsx          # Wallet context + payWithWallet()
    ├── types.ts                   # Shared TypeScript types
    ├── utils.ts                   # shadcn utility (cn)
    └── x402.ts                    # Payment verification helpers
```

---

## Contributing — Adding an Aggregator

Stacks Refill uses an **Aggregator** pattern so new service providers can be plugged in without touching any UI or API route code.

### Step 1 — Implement the `Aggregator` interface

Create `src/lib/aggregators/<name>.ts` and export a class implementing the interface:

```typescript
import type {
  Aggregator,
  AggregatorInfo,
  CountryCode,
  FulfillmentRequest,
  FulfillmentResult,
  ServicePlan,
  ServiceProvider,
  ServiceType,
} from "./types";

export class MyAggregator implements Aggregator {
  info: AggregatorInfo = {
    id: "my-aggregator",
    name: "My Aggregator",
    website: "https://example.com",
    countries: ["GH", "KE"],           // countries you cover
    serviceTypes: ["airtime", "data"],  // services you handle
    description: "Aggregator for Ghana & Kenya",
  };

  async getProviders(
    serviceType: ServiceType,
    country: CountryCode,
  ): Promise<ServiceProvider[]> {
    // Return array of providers (e.g. Vodafone, Safaricom)
  }

  async getPlans(serviceID: string): Promise<ServicePlan[]> {
    // Return plan variations (empty array for airtime / custom-amount services)
  }

  async fulfil(request: FulfillmentRequest): Promise<FulfillmentResult> {
    // Call your provider API, return a standardised FulfillmentResult
  }

  validateRecipient(recipient: string, serviceType: ServiceType): boolean {
    // Return true if the format looks valid
  }
}
```

### Step 2 — Register in the registry

Open `src/lib/aggregators/registry.ts` and add your instance to the `aggregators` array:

```typescript
import { MyAggregator } from "./my-aggregator";

const aggregators: Aggregator[] = [
  new VTPassAggregator(),
  new MyAggregator(),     // ← add here
];
```

That's it. The registry auto-maps your countries and service types so the API routes and UI pick them up automatically.

### Step 3 — Add a new service type (optional)

If your aggregator handles a service type that doesn't exist yet:

1. Add it to the `ServiceType` union in `src/lib/aggregators/types.ts`
2. Add metadata in the `SERVICE_CATALOGUE` array in `src/lib/aggregators/registry.ts`
3. Add your service type to the `activeTypes` array in `getServiceAvailability()` when it's ready

### Key Types Reference

| Type | Purpose |
|---|---|
| `ServiceType` | Union of all service categories (`"airtime"` `"data"` `"tv"` `"electricity"` `"education"`) |
| `CountryCode` | ISO 3166-1 alpha-2 codes the platform supports |
| `ServiceProvider` | A provider within a service (id, name, serviceID, logo) |
| `ServicePlan` | A selectable plan/variation (code, name, amount, currency) |
| `FulfillmentRequest` | Params passed to `fulfil()` after payment verification |
| `FulfillmentResult` | Standardised result: success, transactionId, status, productName, amount, currency |
| `Aggregator` | The interface — `getProviders`, `getPlans`, `fulfil`, `validateRecipient` |

### Running in Sandbox Mode

Set `VTPASS_BASE_URL=https://sandbox.vtpass.com/api` and use VTPass sandbox test numbers (e.g. `08011111111`) for development.

---

## Supported Services

| Service | Status | Countries |
|---|---|---|
| Airtime | ✅ Live | Nigeria |
| Data Bundles | ✅ Live | Nigeria |
| TV Subscription | 🔜 Coming Soon | — |
| Electricity | 🔜 Coming Soon | — |
| Education PINs | 🔜 Coming Soon | — |

Want to bring a service or country online? [See Contributing](#contributing--adding-an-aggregator).

## License

MIT
