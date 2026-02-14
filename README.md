# Stacks Refill

Buy Nigerian Airtime & Data with Stacks crypto assets (STX, sBTC, USDCx) using the **x402 payment protocol**.

Built for the **x402 Stacks Challenge Hackathon**.

## How It Works

1. User selects a service (Airtime or Data), picks a network provider, and enters a phone number
2. The app fetches live crypto-to-NGN prices from **CoinGecko** and calculates the required crypto amount
3. When the user submits, the API returns **HTTP 402 Payment Required** with x402 payment instructions
4. The client signs a Stacks transaction and retries with the `payment-signature` header
5. The server verifies the payment via the **x402 facilitator**, then calls **VTPass** to deliver the airtime/data

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **Payments**: [x402-stacks](https://www.npmjs.com/package/x402-stacks) (STX, sBTC, USDCx)
- **Fulfillment**: [VTPass API](https://vtpass.com/documentation/) (Airtime & Data)
- **Price Feed**: [CoinGecko API](https://docs.coingecko.com/)
- **Runtime**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- VTPass account (sandbox or live) — [Create one](https://sandbox.vtpass.com/register)
- CoinGecko API key (free demo) — [Get one](https://www.coingecko.com/en/api)
- A Stacks wallet address to receive payments

### Setup

```bash
# Clone and install
git clone <repo-url>
cd stacks-refill
bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your actual keys

# Run dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `STACKS_ADDRESS` | Your Stacks mainnet address (SP...) |
| `FACILITATOR_URL` | x402 facilitator endpoint |
| `NETWORK` | `mainnet` or `testnet` |
| `COINGECKO_API_KEY` | CoinGecko demo API key |
| `VTPASS_API_KEY` | VTPass API key |
| `VTPASS_SECRET_KEY` | VTPass secret key (for POST requests) |
| `VTPASS_PUBLIC_KEY` | VTPass public key (for GET requests) |
| `VTPASS_BASE_URL` | `https://sandbox.vtpass.com/api` or `https://vtpass.com/api` |

## API Endpoints

### `GET /api/prices`
Returns current STX, sBTC, USDCx prices in NGN. Public, no payment required.

### `GET /api/plans?serviceID=mtn-data`
Returns available data plan variations for a provider. Public, no payment required.

### `POST /api/purchase`
x402-gated purchase endpoint. Requires `payment-signature` header with a signed Stacks transaction.

**Request body:**
```json
{
  "type": "airtime",
  "serviceID": "mtn",
  "phone": "08012345678",
  "amount": 500,
  "cryptoType": "STX"
}
```

**For data:**
```json
{
  "type": "data",
  "serviceID": "mtn-data",
  "phone": "08012345678",
  "amount": 1000,
  "variationCode": "mtn-100mb-1000",
  "cryptoType": "sBTC"
}
```

## Testing with x402-stacks Client

```typescript
import axios from 'axios';
import { wrapAxiosWithPayment, privateKeyToAccount } from 'x402-stacks';

const account = privateKeyToAccount(process.env.PRIVATE_KEY!, 'mainnet');
const api = wrapAxiosWithPayment(
  axios.create({ baseURL: 'http://localhost:3000' }),
  account
);

// Automatic 402 → sign → retry flow
const response = await api.post('/api/purchase', {
  type: 'airtime',
  serviceID: 'mtn',
  phone: '08011111111', // VTPass sandbox success number
  amount: 500,
  cryptoType: 'STX',
});

console.log(response.data);
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── plans/route.ts      # GET data plan variations
│   │   ├── prices/route.ts     # GET crypto prices in NGN
│   │   └── purchase/route.ts   # POST x402-gated purchase
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Frontend UI
├── components/ui/              # shadcn/ui components
└── lib/
    ├── coingecko.ts            # CoinGecko price feed (60s cache)
    ├── types.ts                # Shared TypeScript types
    ├── utils.ts                # shadcn utility (cn)
    ├── vtpass.ts               # VTPass API client
    └── x402.ts                 # x402 payment gate for App Router
```

## License

MIT
