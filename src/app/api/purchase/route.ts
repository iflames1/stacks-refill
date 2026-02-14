import { NextResponse } from "next/server";
import { getCryptoPricesInNGN, calculateCryptoAmount } from "@/lib/coingecko";
import { getAggregatorFor, getServiceMeta } from "@/lib/aggregators";
import type {
	ServiceType,
	CountryCode,
	FulfillmentRequest,
} from "@/lib/aggregators";
import {
	gatePayment,
	getAssetConfig,
	toAtomicUnits,
	buildPaymentResponseHeader,
	getNetworkCAIP2,
	verifyTransactionOnChain,
} from "@/lib/x402";
import type { CryptoType } from "@/lib/types";

// Valid crypto types
const VALID_CRYPTO: CryptoType[] = ["STX", "sBTC", "USDCx"];

/**
 * Map CryptoType to the key used in CryptoPrices
 */
function priceKey(cryptoType: CryptoType): "stx" | "sbtc" | "usdcx" {
	switch (cryptoType) {
		case "STX":
			return "stx";
		case "sBTC":
			return "sbtc";
		case "USDCx":
			return "usdcx";
		default:
			return "stx";
	}
}

/**
 * POST /api/purchase
 *
 * Aggregator-backed purchase endpoint.
 *
 * Flow:
 * 1. Parse & validate the purchase request body
 * 2. Resolve the aggregator for service + country
 * 3. Fetch current crypto-to-NGN price from CoinGecko
 * 4. Calculate required crypto amount (with 2% slippage buffer)
 * 5. Gate the request via wallet txid or x402 facilitator
 * 6. On verified payment → call aggregator.fulfil()
 * 7. Return success with fulfilment details + payment info
 */
export async function POST(request: Request) {
	// ─── Step 1: Parse & Validate ───
	let body: {
		serviceType: string;
		serviceID: string;
		recipient: string;
		amount: number;
		variationCode?: string;
		cryptoType: string;
		country?: string;
		extras?: Record<string, string>;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON body" },
			{ status: 400 }
		);
	}

	const {
		serviceType: rawServiceType,
		serviceID,
		recipient,
		amount,
		variationCode,
		cryptoType: rawCryptoType,
		country: rawCountry,
		extras,
	} = body;

	const serviceType = rawServiceType as ServiceType;
	const cryptoType = rawCryptoType as CryptoType;
	const country = (rawCountry || "NG") as CountryCode;

	// Validate serviceType
	const serviceMeta = getServiceMeta(serviceType);
	if (!serviceMeta) {
		return NextResponse.json(
			{
				success: false,
				error: `Unknown service type: ${rawServiceType}`,
			},
			{ status: 400 }
		);
	}

	// Validate serviceID
	if (!serviceID) {
		return NextResponse.json(
			{ success: false, error: "serviceID is required" },
			{ status: 400 }
		);
	}

	// Validate recipient
	if (!recipient) {
		return NextResponse.json(
			{
				success: false,
				error: `${serviceMeta.recipientLabel} is required`,
			},
			{ status: 400 }
		);
	}

	// ─── Step 2: Resolve aggregator ───
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

	// Validate recipient format via aggregator
	if (!aggregator.validateRecipient(recipient, serviceType)) {
		return NextResponse.json(
			{
				success: false,
				error: `Invalid ${serviceMeta.recipientLabel.toLowerCase()}: ${recipient}`,
			},
			{ status: 400 }
		);
	}

	// Validate amount
	if (!amount || amount <= 0) {
		return NextResponse.json(
			{
				success: false,
				error: "Amount must be a positive number (in local currency)",
			},
			{ status: 400 }
		);
	}

	// Validate cryptoType
	if (!cryptoType || !VALID_CRYPTO.includes(cryptoType)) {
		return NextResponse.json(
			{
				success: false,
				error: `cryptoType must be one of: ${VALID_CRYPTO.join(", ")}`,
			},
			{ status: 400 }
		);
	}

	// Validate variationCode for plan-based services
	if (serviceMeta.requiresPlan && !variationCode) {
		return NextResponse.json(
			{
				success: false,
				error: "variationCode is required for this service",
			},
			{ status: 400 }
		);
	}

	// ─── Step 3: Fetch Prices ───
	let prices;
	try {
		prices = await getCryptoPricesInNGN();
	} catch (error) {
		console.error("Price fetch error:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch current crypto prices" },
			{ status: 503 }
		);
	}

	const tokenPriceInNGN = prices[priceKey(cryptoType)];
	if (!tokenPriceInNGN || tokenPriceInNGN <= 0) {
		return NextResponse.json(
			{ success: false, error: `No price available for ${cryptoType}` },
			{ status: 503 }
		);
	}

	// ─── Step 4: Calculate Crypto Amount ───
	const cryptoAmount = calculateCryptoAmount(amount, tokenPriceInNGN, 2);
	const atomicAmount = toAtomicUnits(cryptoAmount, cryptoType);

	// ─── Step 5: Payment Gate ───
	const network = getNetworkCAIP2();
	const payTo = process.env.STACKS_ADDRESS!;
	const facilitatorUrl =
		process.env.FACILITATOR_URL || "https://facilitator.x402stacks.xyz";

	const { asset } = getAssetConfig(
		cryptoType,
		(process.env.NETWORK as "mainnet" | "testnet") || "mainnet"
	);

	const paymentConfig = {
		amount: atomicAmount,
		payTo,
		network,
		asset,
		facilitatorUrl,
		description: `${serviceMeta.name}: ₦${amount} for ${recipient}`,
		tokenType: cryptoType,
	};

	// Build the fulfilment request once
	const fulfilReq: FulfillmentRequest = {
		serviceType,
		serviceID,
		recipient: recipient.trim(),
		amount,
		variationCode,
		extras,
	};

	// ─── Flow A: Wallet-signed transaction (x-payment-txid header) ───
	const walletTxId = request.headers.get("x-payment-txid");

	if (walletTxId) {
		const verification = await verifyTransactionOnChain(
			walletTxId,
			payTo,
			atomicAmount,
			cryptoType
		);

		if (!verification.verified) {
			return NextResponse.json(
				{
					success: false,
					error: "Transaction verification failed",
					details: verification.error,
				},
				{ status: 400 }
			);
		}

		// Tx verified → fulfil via aggregator
		let fulfilResult;
		try {
			fulfilResult = await aggregator.fulfil(fulfilReq);
		} catch (error) {
			console.error("Fulfillment error:", error);
			return NextResponse.json(
				{
					success: false,
					error: `Payment verified but ${aggregator.info.name} fulfilment failed`,
					payment: {
						txId: verification.txid,
						payer: verification.payer,
						cryptoType,
						cryptoAmount: cryptoAmount.toFixed(8),
						ngnAmount: amount,
					},
					details:
						error instanceof Error
							? error.message
							: "Unknown error",
				},
				{ status: 502 }
			);
		}

		return NextResponse.json({
			success: fulfilResult.success,
			message: fulfilResult.success
				? `${serviceMeta.name} purchase successful!`
				: `Fulfilment status: ${fulfilResult.status}`,
			fulfilment: {
				transactionId: fulfilResult.transactionId,
				status: fulfilResult.status,
				productName: fulfilResult.productName,
				amount: fulfilResult.amount,
				currency: fulfilResult.currency,
			},
			payment: {
				txId: verification.txid,
				payer: verification.payer,
				network:
					(process.env.NETWORK as "mainnet" | "testnet") || "mainnet",
				cryptoType,
				cryptoAmount: cryptoAmount.toFixed(8),
				ngnAmount: amount,
			},
		});
	}

	// ─── Flow B / C: x402 facilitator flow or 402 ───
	const gateResult = await gatePayment(request, paymentConfig);

	if (gateResult instanceof NextResponse) {
		return gateResult;
	}

	// ─── Step 6: Payment verified! Fulfil via aggregator ───
	let fulfilResult;
	try {
		fulfilResult = await aggregator.fulfil(fulfilReq);
	} catch (error) {
		console.error("Fulfillment error:", error);
		return NextResponse.json(
			{
				success: false,
				error: `Payment was verified but ${aggregator.info.name} fulfilment failed`,
				payment: {
					txId: gateResult.settlement.transaction,
					payer: gateResult.settlement.payer,
					cryptoType,
					cryptoAmount: cryptoAmount.toFixed(8),
					ngnAmount: amount,
				},
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 502 }
		);
	}

	// ─── Step 7: Return Success ───
	const responseData = {
		success: fulfilResult.success,
		message: fulfilResult.success
			? `${serviceMeta.name} purchase successful!`
			: `Fulfilment status: ${fulfilResult.status}`,
		fulfilment: {
			transactionId: fulfilResult.transactionId,
			status: fulfilResult.status,
			productName: fulfilResult.productName,
			amount: fulfilResult.amount,
			currency: fulfilResult.currency,
		},
		payment: {
			txId: gateResult.settlement.transaction,
			payer: gateResult.settlement.payer,
			network: gateResult.settlement.network,
			cryptoType,
			cryptoAmount: cryptoAmount.toFixed(8),
			ngnAmount: amount,
		},
	};

	const response = NextResponse.json(responseData, { status: 200 });
	response.headers.set(
		"payment-response",
		buildPaymentResponseHeader(gateResult.settlement)
	);

	return response;
}
