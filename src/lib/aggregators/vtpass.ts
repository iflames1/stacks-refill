/**
 * VTPass Aggregator — reference implementation
 *
 * Covers Nigeria (NG) services:
 *   ✅ Airtime   ✅ Data   🔜 TV   🔜 Electricity   🔜 Education
 *
 * Docs: https://www.vtpass.com/documentation/
 */

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

// ─── VTPass HTTP helpers ───

function getBaseUrl(): string {
	return process.env.VTPASS_BASE_URL || "https://sandbox.vtpass.com/api";
}

function getHeaders(method: "GET" | "POST"): Record<string, string> {
	const apiKey = process.env.VTPASS_API_KEY || "";
	if (method === "GET") {
		return {
			"api-key": apiKey,
			"public-key": process.env.VTPASS_PUBLIC_KEY || "",
		};
	}
	return {
		"api-key": apiKey,
		"secret-key": process.env.VTPASS_SECRET_KEY || "",
		"Content-Type": "application/json",
	};
}

function generateRequestId(): string {
	const now = new Date();
	const lagosTime = new Date(
		now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
	);
	const y = lagosTime.getFullYear();
	const mo = (lagosTime.getMonth() + 1).toString().padStart(2, "0");
	const d = lagosTime.getDate().toString().padStart(2, "0");
	const h = lagosTime.getHours().toString().padStart(2, "0");
	const mi = lagosTime.getMinutes().toString().padStart(2, "0");
	const suffix = Math.random().toString(36).substring(2, 10);
	return `${y}${mo}${d}${h}${mi}${suffix}`;
}

// ─── Static provider catalogue ───

const AIRTIME_PROVIDERS: ServiceProvider[] = [
	{ id: "mtn", name: "MTN", serviceID: "mtn", logo: "🟡" },
	{ id: "airtel", name: "Airtel", serviceID: "airtel", logo: "🔴" },
	{ id: "glo", name: "Glo", serviceID: "glo", logo: "🟢" },
	{ id: "etisalat", name: "9mobile", serviceID: "etisalat", logo: "🟩" },
];

const DATA_PROVIDERS: ServiceProvider[] = [
	{ id: "mtn-data", name: "MTN", serviceID: "mtn-data", logo: "🟡" },
	{
		id: "airtel-data",
		name: "Airtel",
		serviceID: "airtel-data",
		logo: "🔴",
	},
	{ id: "glo-data", name: "Glo", serviceID: "glo-data", logo: "🟢" },
	{
		id: "etisalat-data",
		name: "9mobile",
		serviceID: "etisalat-data",
		logo: "🟩",
	},
];

// Providers for future services (stubs)
const TV_PROVIDERS: ServiceProvider[] = [
	{ id: "dstv", name: "DStv", serviceID: "dstv", logo: "📺" },
	{ id: "gotv", name: "GOtv", serviceID: "gotv", logo: "📺" },
	{
		id: "startimes",
		name: "StarTimes",
		serviceID: "startimes",
		logo: "📺",
	},
];

const ELECTRICITY_PROVIDERS: ServiceProvider[] = [
	{
		id: "ikeja-electric",
		name: "Ikeja Electric",
		serviceID: "ikeja-electric",
		logo: "⚡",
	},
	{
		id: "eko-electric",
		name: "Eko Electric",
		serviceID: "eko-electric",
		logo: "⚡",
	},
	{
		id: "abuja-electric",
		name: "Abuja Electric",
		serviceID: "abuja-electric",
		logo: "⚡",
	},
];

const EDUCATION_PROVIDERS: ServiceProvider[] = [
	{ id: "waec", name: "WAEC", serviceID: "waec", logo: "🎓" },
	{
		id: "jamb",
		name: "JAMB UTME PIN",
		serviceID: "jamb",
		logo: "🎓",
	},
];

const PROVIDER_MAP: Partial<Record<ServiceType, ServiceProvider[]>> = {
	airtime: AIRTIME_PROVIDERS,
	data: DATA_PROVIDERS,
	tv: TV_PROVIDERS,
	electricity: ELECTRICITY_PROVIDERS,
	education: EDUCATION_PROVIDERS,
};

// ─── VTPass Aggregator Class ───

export class VTPassAggregator implements Aggregator {
	info: AggregatorInfo = {
		id: "vtpass",
		name: "VTPass",
		website: "https://vtpass.com",
		countries: ["NG"],
		serviceTypes: ["airtime", "data", "tv", "electricity", "education"],
		description:
			"Nigeria's leading bill payment platform. Supports airtime, data, TV subscriptions, electricity bills, and education pins.",
	};

	async getProviders(
		serviceType: ServiceType,
		_country: CountryCode,
	): Promise<ServiceProvider[]> {
		return PROVIDER_MAP[serviceType] ?? [];
	}

	async getPlans(serviceID: string): Promise<ServicePlan[]> {
		const baseUrl = getBaseUrl();
		const url = `${baseUrl}/service-variations?serviceID=${encodeURIComponent(serviceID)}`;

		const response = await fetch(url, {
			method: "GET",
			headers: getHeaders("GET"),
		});

		if (!response.ok) {
			throw new Error(
				`VTPass variations error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		const variations = data.content?.variations;
		if (!variations || !Array.isArray(variations)) return [];

		return variations.map(
			(v: {
				variation_code: string;
				name: string;
				variation_amount: string;
			}) => ({
				code: v.variation_code,
				name: v.name,
				amount: Number(v.variation_amount),
				currency: "NGN",
			}),
		);
	}

	async fulfil(req: FulfillmentRequest): Promise<FulfillmentResult> {
		const baseUrl = getBaseUrl();
		const requestId = req.requestId || generateRequestId();

		// Build the VTPass-specific body
		const body: Record<string, unknown> = {
			request_id: requestId,
			serviceID: req.serviceID,
			phone: req.recipient,
			amount: req.amount,
		};

		// Data, TV, Electricity, Education need variation_code and sometimes billersCode
		if (req.variationCode) {
			body.variation_code = req.variationCode;
		}
		if (
			req.serviceType === "data" ||
			req.serviceType === "tv" ||
			req.serviceType === "electricity" ||
			req.serviceType === "education"
		) {
			body.billersCode = req.extras?.billersCode || req.recipient;
		}

		const response = await fetch(`${baseUrl}/pay`, {
			method: "POST",
			headers: getHeaders("POST"),
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(
				`VTPass purchase error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		const tx = data.content?.transactions;
		const isSuccess = data.code === "000" || tx?.status === "delivered";

		return {
			success: isSuccess,
			transactionId: tx?.transactionId || requestId,
			status: isSuccess
				? "delivered"
				: tx?.status === "pending"
					? "pending"
					: "failed",
			productName: tx?.product_name || req.serviceID,
			amount: tx?.total_amount || req.amount,
			currency: "NGN",
			rawResponse: data,
		};
	}

	validateRecipient(recipient: string, serviceType: ServiceType): boolean {
		const cleaned = recipient.replace(/\s|-/g, "");
		switch (serviceType) {
			case "airtime":
			case "data":
				// Nigerian phone: 080x, 081x, 070x, 090x, +234...
				return /^(\+?234|0)[789]\d{9}$/.test(cleaned);
			case "tv":
				// Smart card / IUC number (10-digit numeric)
				return /^\d{10,}$/.test(cleaned);
			case "electricity":
				// Meter number (11-13 digit numeric)
				return /^\d{11,13}$/.test(cleaned);
			case "education":
				// Profile code or phone number
				return /^\d{7,15}$/.test(cleaned);
			default:
				return cleaned.length > 0;
		}
	}

	async verifyCustomer(
		serviceID: string,
		recipient: string,
		variationCode?: string,
	): Promise<string | null> {
		const baseUrl = getBaseUrl();
		const body: Record<string, string> = {
			serviceID,
			billersCode: recipient,
		};
		if (variationCode) {
			body.type = variationCode;
		}

		try {
			const response = await fetch(`${baseUrl}/merchant-verify`, {
				method: "POST",
				headers: getHeaders("POST"),
				body: JSON.stringify(body),
			});

			if (!response.ok) return null;

			const data = await response.json();
			const content = data.content;
			if (!content) return null;

			return (
				content.Customer_Name ||
				content.name ||
				content.customerName ||
				content.fullName ||
				null
			);
		} catch (error) {
			console.error("VTPass verify error:", error);
			return null;
		}
	}
}
