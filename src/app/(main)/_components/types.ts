// Shared types used across (main) components

export type CryptoType = "STX" | "sBTC" | "USDCx";

export interface ServiceProvider {
	id: string;
	name: string;
	serviceID: string;
	logo?: string;
}

export interface ServicePlan {
	code: string;
	name: string;
	amount: number;
	currency: string;
	description?: string;
}

export interface ServiceInfo {
	type: string;
	name: string;
	description: string;
	icon: string;
	recipientLabel: string;
	recipientPlaceholder: string;
	requiresPlan: boolean;
	allowCustomAmount: boolean;
	quickAmounts?: number[];
	providers: ServiceProvider[];
	aggregator: string | null;
	country: string;
}

export interface ComingSoon {
	type: string;
	name: string;
	description: string;
	icon: string;
}

export interface CryptoPrices {
	stx: number;
	sbtc: number;
	usdcx: number;
}

export interface PurchaseResult {
	success: boolean;
	message: string;
	fulfilment?: {
		transactionId: string;
		status: string;
		productName: string;
		amount: number;
		currency: string;
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
	details?: string;
}

export type PurchaseStep =
	| "idle"
	| "fetching-price"
	| "awaiting-wallet"
	| "confirming"
	| "success"
	| "error";

export const CRYPTO_OPTIONS: {
	value: CryptoType;
	label: string;
	icon: string;
	desc: string;
}[] = [
	{ value: "STX", label: "STX", icon: "⚡", desc: "Stacks" },
	{ value: "sBTC", label: "sBTC", icon: "₿", desc: "Bitcoin on Stacks" },
	{ value: "USDCx", label: "USDCx", icon: "💲", desc: "USDC on Stacks" },
];
