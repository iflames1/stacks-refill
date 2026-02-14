import { NextResponse } from "next/server";
import { getServiceVariations } from "@/lib/vtpass";

/**
 * GET /api/plans?serviceID=mtn-data
 *
 * Returns available data plan variations for a given VTPass service.
 * Public endpoint — no payment required.
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const serviceID = searchParams.get("serviceID");

		if (!serviceID) {
			return NextResponse.json(
				{
					success: false,
					error: "Missing serviceID parameter",
					hint: "Use one of: mtn-data, airtel-data, glo-data, etisalat-data",
				},
				{ status: 400 }
			);
		}

		const validServiceIDs = [
			"mtn-data",
			"airtel-data",
			"glo-data",
			"etisalat-data",
		];

		if (!validServiceIDs.includes(serviceID)) {
			return NextResponse.json(
				{
					success: false,
					error: `Invalid serviceID: ${serviceID}`,
					validOptions: validServiceIDs,
				},
				{ status: 400 }
			);
		}

		const plans = await getServiceVariations(serviceID);

		return NextResponse.json({
			success: true,
			serviceID,
			plans,
			count: plans.length,
		});
	} catch (error) {
		console.error("Plans fetch error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch data plans",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
