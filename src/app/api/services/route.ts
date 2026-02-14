import { NextResponse } from "next/server";
import { getServiceAvailability, getAggregatorFor } from "@/lib/aggregators";
import type { CountryCode, ServiceType } from "@/lib/aggregators";

/**
 * GET /api/services
 *
 * Returns the service catalogue: available and coming-soon services,
 * plus providers for available services in the given country.
 *
 * Query params:
 *   country - ISO 3166-1 alpha-2 (default: "NG")
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const country = (searchParams.get("country") || "NG") as CountryCode;

	const { available, comingSoon } = getServiceAvailability();

	// Fetch providers for each available service
	const servicesWithProviders = await Promise.all(
		available.map(async (svc) => {
			const aggregator = getAggregatorFor(
				svc.type as ServiceType,
				country
			);
			const providers = aggregator
				? await aggregator.getProviders(
						svc.type as ServiceType,
						country
					)
				: [];

			return {
				...svc,
				providers,
				aggregator: aggregator?.info.id || null,
				country,
			};
		})
	);

	return NextResponse.json({
		success: true,
		available: servicesWithProviders,
		comingSoon: comingSoon.map((s) => ({
			type: s.type,
			name: s.name,
			description: s.description,
			icon: s.icon,
		})),
	});
}
