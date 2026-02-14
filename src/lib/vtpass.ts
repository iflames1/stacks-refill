import type {
	DataPlan,
	VTPassVariationsResponse,
	VTPassPurchaseResponse,
} from "./types";

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

	// POST requests use secret-key
	return {
		"api-key": apiKey,
		"secret-key": process.env.VTPASS_SECRET_KEY || "",
		"Content-Type": "application/json",
	};
}

/**
 * Generate a VTPass-compatible request ID.
 * Format: first 12 chars = YYYYMMDDHHII (Africa/Lagos, GMT+1), then random suffix.
 */
export function generateRequestId(): string {
	const now = new Date();
	// Africa/Lagos is GMT+1
	const lagosTime = new Date(
		now.toLocaleString("en-US", { timeZone: "Africa/Lagos" })
	);

	const year = lagosTime.getFullYear().toString();
	const month = (lagosTime.getMonth() + 1).toString().padStart(2, "0");
	const day = lagosTime.getDate().toString().padStart(2, "0");
	const hours = lagosTime.getHours().toString().padStart(2, "0");
	const minutes = lagosTime.getMinutes().toString().padStart(2, "0");

	const datePrefix = `${year}${month}${day}${hours}${minutes}`;
	const suffix = Math.random().toString(36).substring(2, 10);

	return `${datePrefix}${suffix}`;
}

/**
 * Fetch available data plan variations for a given service.
 * e.g., serviceID = "mtn-data" returns all MTN data bundles.
 */
export async function getServiceVariations(
	serviceID: string
): Promise<DataPlan[]> {
	const baseUrl = getBaseUrl();
	const url = `${baseUrl}/service-variations?serviceID=${encodeURIComponent(serviceID)}`;

	const response = await fetch(url, {
		method: "GET",
		headers: getHeaders("GET"),
	});

	if (!response.ok) {
		throw new Error(
			`VTPass variations error: ${response.status} ${response.statusText}`
		);
	}

	const data: VTPassVariationsResponse = await response.json();

	if (!data.content?.variations) {
		return [];
	}

	return data.content.variations;
}

/**
 * Purchase airtime (VTU) for a given phone number.
 */
export async function purchaseAirtime(params: {
	serviceID: string;
	phone: string;
	amount: number;
	requestId?: string;
}): Promise<VTPassPurchaseResponse> {
	const baseUrl = getBaseUrl();
	const requestId = params.requestId || generateRequestId();

	const body = {
		request_id: requestId,
		serviceID: params.serviceID,
		amount: params.amount,
		phone: params.phone,
	};

	const response = await fetch(`${baseUrl}/pay`, {
		method: "POST",
		headers: getHeaders("POST"),
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(
			`VTPass purchase error: ${response.status} ${response.statusText}`
		);
	}

	return response.json();
}

/**
 * Purchase a data subscription plan for a given phone number.
 */
export async function purchaseData(params: {
	serviceID: string;
	phone: string;
	variationCode: string;
	requestId?: string;
}): Promise<VTPassPurchaseResponse> {
	const baseUrl = getBaseUrl();
	const requestId = params.requestId || generateRequestId();

	const body = {
		request_id: requestId,
		serviceID: params.serviceID,
		billersCode: params.phone,
		variation_code: params.variationCode,
		phone: params.phone,
	};

	const response = await fetch(`${baseUrl}/pay`, {
		method: "POST",
		headers: getHeaders("POST"),
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(
			`VTPass data error: ${response.status} ${response.statusText}`
		);
	}

	return response.json();
}

/**
 * Requery a transaction to check its status.
 */
export async function requeryTransaction(
	requestId: string
): Promise<VTPassPurchaseResponse> {
	const baseUrl = getBaseUrl();

	const response = await fetch(`${baseUrl}/requery`, {
		method: "POST",
		headers: getHeaders("POST"),
		body: JSON.stringify({ request_id: requestId }),
	});

	if (!response.ok) {
		throw new Error(
			`VTPass requery error: ${response.status} ${response.statusText}`
		);
	}

	return response.json();
}
