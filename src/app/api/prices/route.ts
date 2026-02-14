import { NextResponse } from "next/server";
import { getCryptoPricesInNGN } from "@/lib/coingecko";

/**
 * GET /api/prices
 *
 * Returns current prices of STX, sBTC, and USDCx in Nigerian Naira.
 * Uses CoinGecko Simple Price API with 60s cache.
 * Public endpoint — no payment required.
 */
export async function GET() {
	try {
		const prices = await getCryptoPricesInNGN();

		return NextResponse.json({
			success: true,
			prices,
			currency: "NGN",
			cached: true,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Price fetch error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch crypto prices",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
