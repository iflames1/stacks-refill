// ============================
// Crypto & Pricing Types
// ============================

export type CryptoType = "STX" | "sBTC" | "USDCx";

export interface CryptoPrices {
	stx: number; // Price of 1 STX in NGN
	sbtc: number; // Price of 1 sBTC in NGN
	usdcx: number; // Price of 1 USDCx (USDC) in NGN
}

// ============================
// Network Providers
// ============================

export type NetworkProvider = "mtn" | "airtel" | "glo" | "etisalat";

export const NETWORK_PROVIDERS: Record<NetworkProvider, string> = {
	mtn: "MTN",
	airtel: "Airtel",
	glo: "Glo",
	etisalat: "9mobile",
};

export const AIRTIME_SERVICE_IDS: Record<NetworkProvider, string> = {
	mtn: "mtn",
	airtel: "airtel",
	glo: "glo",
	etisalat: "etisalat",
};

export const DATA_SERVICE_IDS: Record<NetworkProvider, string> = {
	mtn: "mtn-data",
	airtel: "airtel-data",
	glo: "glo-data",
	etisalat: "etisalat-data",
};

// ============================
// VTPass Types
// ============================

export interface DataPlan {
	variation_code: string;
	name: string;
	variation_amount: string;
	fixedPrice: string;
}

export interface VTPassVariationsResponse {
	response_description: string;
	content: {
		ServiceName: string;
		serviceID: string;
		conType: string;
		variations: DataPlan[];
	};
}

export interface VTPassPurchaseResponse {
	code: string;
	response_description: string;
	requestId: string;
	amount: string;
	transaction_date: {
		date: string;
	};
	content: {
		transactions: {
			status: string;
			product_name: string;
			unique_element: string;
			unit_price: number;
			quantity: number;
			service_verification: string | null;
			channel: string;
			commission: number;
			total_amount: number;
			discount: number | null;
			type: string;
			email: string;
			phone: string;
			name: string | null;
			conType: string;
			conTypeCode: string;
			transactionId: string;
		};
	};
}

// ============================
// Purchase Request/Response
// ============================

export interface PurchaseRequest {
	type: "airtime" | "data";
	serviceID: string;
	phone: string;
	amount: number; // NGN value
	variationCode?: string; // Required for data purchases
	cryptoType: CryptoType;
}

export interface PurchaseResponse {
	success: boolean;
	message: string;
	vtpass?: {
		requestId: string;
		status: string;
		productName: string;
		transactionId: string;
		amount: number;
	};
	payment?: {
		txId?: string;
		payer?: string;
		network?: string;
		cryptoType: CryptoType;
		cryptoAmount: string;
		ngnAmount: number;
	};
	error?: string;
}

// ============================
// x402 Payment Gate Types
// ============================

export interface PaymentGateConfig {
	amount: bigint;
	payTo: string;
	network: string;
	asset: string;
	facilitatorUrl: string;
	description?: string;
	tokenType?: CryptoType;
}

export interface PaymentGateResult {
	paid: true;
	settlement: {
		success: boolean;
		payer?: string;
		transaction?: string;
		network?: string;
	};
}

// ============================
// Local Storage History
// ============================

export interface LocalTransaction {
	id: string;
	date: string;
	serviceType: string;
	productName: string;
	recipient: string;
	amount: number;
	currency: string;
	cryptoAmount: string;
	cryptoType: string;
	status: "delivered" | "pending" | "failed";
	txId?: string;
	ref?: string;
}
