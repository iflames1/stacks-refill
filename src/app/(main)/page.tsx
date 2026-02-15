"use client";

import { useState, useEffect, useCallback } from "react";
import type { ServiceInfo, ComingSoon, CryptoPrices } from "./_components/types";
import { PriceTicker } from "./_components/price-ticker";
import { ConnectBanner } from "./_components/connect-banner";
import { ServiceGrid } from "./_components/service-grid";
import { PurchaseForm } from "./_components/purchase-form";

export default function HomePage() {
	// ─── Service catalogue ───
	const [country, setCountry] = useState<"NG">("NG"); // Default to NG for MVP
	const [services, setServices] = useState<ServiceInfo[]>([]);
	const [comingSoon, setComingSoon] = useState<ComingSoon[]>([]);
	const [loadingServices, setLoadingServices] = useState(true);

	// ─── Active service ───
	const [activeService, setActiveService] = useState<ServiceInfo | null>(null);

	// ─── Prices ───
	const [prices, setPrices] = useState<CryptoPrices | null>(null);
	const [loadingPrices, setLoadingPrices] = useState(false);

	// ─── Helpers ───
	const getCurrencySymbol = (c: string) => {
		switch (c) {
			case "NG":
				return "₦";
			case "GH":
				return "₵";
			case "KE":
				return "KSh";
			case "ZA":
				return "R";
			case "US":
				return "$";
			case "GB":
				return "£";
			default:
				return "$";
		}
	};
	const currencySymbol = getCurrencySymbol(country);

	// ─── Fetch services ───
	useEffect(() => {
		(async () => {
			setLoadingServices(true);
			try {
				const res = await fetch(`/api/services?country=${country}`);
				const data = await res.json();
				if (data.success) {
					setServices(data.available || []);
					setComingSoon(data.comingSoon || []);
				}
			} catch (err) {
				console.error("Failed to fetch services:", err);
			} finally {
				setLoadingServices(false);
			}
		})();
	}, [country]);

	// ─── Fetch prices ───
	const fetchPrices = useCallback(async () => {
		setLoadingPrices(true);
		try {
			const res = await fetch("/api/prices");
			const data = await res.json();
			if (data.success) setPrices(data.prices);
		} catch (err) {
			console.error("Failed to fetch prices:", err);
		} finally {
			setLoadingPrices(false);
		}
	}, []);

	useEffect(() => {
		fetchPrices();
		const interval = setInterval(fetchPrices, 600_000);
		return () => clearInterval(interval);
	}, [fetchPrices]);

	// ─── Handlers ───

	const selectService = (svc: ServiceInfo) => setActiveService(svc);
	const goBack = () => setActiveService(null);

	// ─── Render ───

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<PriceTicker prices={prices} loading={loadingPrices} />
			<ConnectBanner />

			{!activeService ? (
				<ServiceGrid
					services={services}
					comingSoon={comingSoon}
					loading={loadingServices}
					onSelect={selectService}
				/>
			) : (
				<PurchaseForm
					service={activeService}
					prices={prices}
					onBack={goBack}
					country={country}
					currencySymbol={currencySymbol}
				/>
			)}
		</div>
	);
}
