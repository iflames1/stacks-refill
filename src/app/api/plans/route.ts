import { NextResponse } from "next/server";
import { getAggregatorFor } from "@/lib/aggregators";
import type { CountryCode, ServiceType } from "@/lib/aggregators";

/**
 * GET /api/plans?serviceID=mtn-data&serviceType=data&country=NG
 *
 * Returns available plan variations for a given service provider.
 * Uses the aggregator abstraction — VTPass for Nigeria, extensible.
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const serviceID = searchParams.get("serviceID");
		const serviceType = (searchParams.get("serviceType") ||
			"data") as ServiceType;
		const country = (searchParams.get("country") || "NG") as CountryCode;

		if (!serviceID) {
			return NextResponse.json(
				{
					success: false,
					error: "Missing serviceID parameter",
					hint: "Pass the provider's serviceID (e.g. mtn-data)",
				},
				{ status: 400 }
			);
		}

		const aggregator = getAggregatorFor(serviceType, country);

		if (!aggregator) {
			return NextResponse.json(
				{
					success: false,
					error: `No aggregator available for ${serviceType} in ${country}`,
				},
				{ status: 404 }
			);
		}

		const plans = await aggregator.getPlans(serviceID);

		return NextResponse.json({
			success: true,
			serviceID,
			serviceType,
			country,
			aggregator: aggregator.info.id,
			plans,
			count: plans.length,
		});
	} catch (error) {
		console.error("Plans fetch error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch plans",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
