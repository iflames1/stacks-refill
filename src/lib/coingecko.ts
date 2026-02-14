import type { CryptoPrices } from "./types";

const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// CoinGecko coin IDs
const COIN_IDS = "blockstack,sbtc-2,usdcx-stacks";

// In-memory cache (60s TTL matches CoinGecko free tier refresh rate)
let cachedPrices: CryptoPrices | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 600_000; // 10 minutes to reduce API calls in order to match CoinGecko's free tier limits

/**
 * Fetch current crypto prices in Nigerian Naira from CoinGecko.
 * Results are cached for 600 seconds to respect rate limits.
 */
export async function getCryptoPricesInNGN(): Promise<CryptoPrices> {
	const now = Date.now();

	// Return cached prices if still fresh
	if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedPrices;
	}

	const apiKey = process.env.COINGECKO_API_KEY;
	const headers: Record<string, string> = {
		Accept: "application/json",
	};

	if (apiKey) {
		headers["x-cg-demo-api-key"] = apiKey;
	}

	const url = `${COINGECKO_API}?ids=${COIN_IDS}&vs_currencies=ngn&precision=2`;

	const response = await fetch(url, { headers });

	if (!response.ok) {
		throw new Error(
			`CoinGecko API error: ${response.status} ${response.statusText}`
		);
	}

	const data = await response.json();

	const prices: CryptoPrices = {
		stx: data.blockstack?.ngn ?? 0,
		sbtc: data["sbtc-2"]?.ngn ?? 0,
		usdcx: data["usdcx-stacks"]?.ngn ?? 0,
	};

	// Validate we got real prices
	if (prices.stx === 0 && prices.sbtc === 0 && prices.usdcx === 0) {
		throw new Error("CoinGecko returned zero prices for all tokens");
	}

	// Update cache
	cachedPrices = prices;
	cacheTimestamp = now;

	return prices;
}

/**
 * Calculate the crypto amount required for a given NGN value.
 * Adds a configurable slippage buffer (default 2%) to protect against
 * price movement between the 402 response and payment settlement.
 */
export function calculateCryptoAmount(
	ngnAmount: number,
	pricePerTokenInNGN: number,
	slippagePercent: number = 2
): number {
	if (pricePerTokenInNGN <= 0) {
		throw new Error("Token price must be positive");
	}
	const baseAmount = ngnAmount / pricePerTokenInNGN;
	const withSlippage = baseAmount * (1 + slippagePercent / 100);
	return withSlippage;
}
