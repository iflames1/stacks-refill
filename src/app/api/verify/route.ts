import { NextResponse } from "next/server";
import type { CountryCode, ServiceType } from "@/lib/aggregators";
import { getAggregatorFor } from "@/lib/aggregators";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const {
			serviceType: rawServiceType,
			serviceID,
			recipient,
			variationCode,
			country: rawCountry,
		} = body;

		if (!serviceID || !recipient) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 },
			);
		}

		const serviceType = rawServiceType as ServiceType;
		const country = (rawCountry || "NG") as CountryCode;

		const aggregator = getAggregatorFor(serviceType, country);

		if (!aggregator) {
			return NextResponse.json(
				{
					success: false,
					error: `No aggregator found for ${serviceType} in ${country}`,
				},
				{ status: 404 },
			);
		}

		if (!aggregator.verifyCustomer) {
			return NextResponse.json({
				success: false,
				message: "Verification not supported by this provider",
			});
		}

		const customerName = await aggregator.verifyCustomer(
			serviceID,
			recipient,
			variationCode,
		);

		if (customerName) {
			return NextResponse.json({
				success: true,
				name: customerName,
			});
		} else {
			return NextResponse.json(
				{
					success: false,
					error: "Could not verify customer details",
				},
				{ status: 404 },
			);
		}
	} catch (error) {
		console.error("Verify API error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
