"use client";

import { Badge } from "@/components/ui/badge";
import type { CryptoPrices, CryptoType } from "./types";
import { CRYPTO_OPTIONS } from "./types";

interface PriceTickerProps {
	prices: CryptoPrices | null;
	loading: boolean;
}

export function PriceTicker({ prices, loading }: PriceTickerProps) {
	if (!prices) return null;

	const priceMap: Record<CryptoType, number> = {
		STX: prices.stx,
		sBTC: prices.sbtc,
		USDCx: prices.usdcx,
	};

	return (
		<div className="mb-6 flex flex-wrap justify-center gap-3">
			{CRYPTO_OPTIONS.map((c) => (
				<Badge
					key={c.value}
					variant="secondary"
					className="px-3 py-1 text-sm"
				>
					{c.icon} 1 {c.label} = ₦
					{priceMap[c.value]?.toLocaleString() || "—"}
				</Badge>
			))}
			{loading && (
				<Badge variant="outline" className="animate-pulse">
					Updating...
				</Badge>
			)}
		</div>
	);
}
