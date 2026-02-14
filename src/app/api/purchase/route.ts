import { NextResponse } from "next/server";
import { getCryptoPricesInNGN, calculateCryptoAmount } from "@/lib/coingecko";
import { purchaseAirtime, purchaseData, generateRequestId } from "@/lib/vtpass";
import {
	gatePayment,
	getAssetConfig,
	toAtomicUnits,
	buildPaymentResponseHeader,
	getNetworkCAIP2,
	verifyTransactionOnChain,
} from "@/lib/x402";
import type { PurchaseRequest, CryptoType } from "@/lib/types";

// Valid airtime service IDs
const AIRTIME_SERVICES = ["mtn", "airtel", "glo", "etisalat"];
// Valid data service IDs
const DATA_SERVICES = ["mtn-data", "airtel-data", "glo-data", "etisalat-data"];

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
 * Validate Nigerian phone number (basic check)
 */
function isValidPhone(phone: string): boolean {
	// Nigerian numbers: 080x, 081x, 070x, 090x, 091x, 011x (11 digits)
	// Also accept +234 prefix
	const cleaned = phone.replace(/\s|-/g, "");
	return /^(\+?234|0)[789]\d{9}$/.test(cleaned);
}

/**
 * POST /api/purchase
 *
 * The core x402-gated endpoint.
 *
 * Flow:
 * 1. Parse & validate the purchase request body
 * 2. Fetch current crypto-to-NGN price from CoinGecko
 * 3. Calculate required crypto amount (with 2% slippage buffer)
 * 4. Gate the request with x402 (returns 402 if no payment-signature header)
 * 5. On verified payment → call VTPass to deliver airtime/data
 * 6. Return success with VTPass transaction details + payment info
 */
export async function POST(request: Request) {
	// ─── Step 1: Parse & Validate ───
	let body: PurchaseRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON body" },
			{ status: 400 }
		);
	}

	const { type, serviceID, phone, amount, variationCode, cryptoType } = body;

	// Validate type
	if (!type || !["airtime", "data"].includes(type)) {
		return NextResponse.json(
			{ success: false, error: 'type must be "airtime" or "data"' },
			{ status: 400 }
		);
	}

	// Validate serviceID
	if (type === "airtime" && !AIRTIME_SERVICES.includes(serviceID)) {
		return NextResponse.json(
			{
				success: false,
				error: `Invalid airtime serviceID: ${serviceID}`,
				validOptions: AIRTIME_SERVICES,
			},
			{ status: 400 }
		);
	}

	if (type === "data" && !DATA_SERVICES.includes(serviceID)) {
		return NextResponse.json(
			{
				success: false,
				error: `Invalid data serviceID: ${serviceID}`,
				validOptions: DATA_SERVICES,
			},
			{ status: 400 }
		);
	}

	// Validate phone
	if (!phone || !isValidPhone(phone)) {
		return NextResponse.json(
			{ success: false, error: "Invalid Nigerian phone number" },
			{ status: 400 }
		);
	}

	// Validate amount
	if (!amount || amount <= 0) {
		return NextResponse.json(
			{
				success: false,
				error: "Amount must be a positive number (in NGN)",
			},
			{ status: 400 }
		);
	}

	// Validate cryptoType
	const validCryptoTypes: CryptoType[] = ["STX", "sBTC", "USDCx"];
	if (!cryptoType || !validCryptoTypes.includes(cryptoType)) {
		return NextResponse.json(
			{
				success: false,
				error: `cryptoType must be one of: ${validCryptoTypes.join(", ")}`,
			},
			{ status: 400 }
		);
	}

	// Validate variationCode for data purchases
	if (type === "data" && !variationCode) {
		return NextResponse.json(
			{
				success: false,
				error: "variationCode is required for data purchases",
			},
			{ status: 400 }
		);
	}

	// ─── Step 2: Fetch Prices ───
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

	// ─── Step 3: Calculate Crypto Amount ───
	const cryptoAmount = calculateCryptoAmount(amount, tokenPriceInNGN, 2);
	const atomicAmount = toAtomicUnits(cryptoAmount, cryptoType);

	// ─── Step 4: x402 Payment Gate ───
	// Supports two payment flows:
	// A) Wallet flow:   x-payment-txid header with broadcast txid → verify on-chain
	// B) x402 flow:     payment-signature header → settle via facilitator
	// C) No header:     return 402 Payment Required with wallet-friendly metadata

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
		description: `${type === "airtime" ? "Airtime" : "Data"} purchase: ₦${amount} for ${phone}`,
		tokenType: cryptoType,
	};

	// ─── Flow A: Wallet-signed transaction (x-payment-txid header) ───
	const walletTxId = request.headers.get("x-payment-txid");

	if (walletTxId) {
		// Verify the transaction on-chain via Stacks API
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

		// Tx verified → fulfil via VTPass
		const requestId = generateRequestId();
		let vtpassResult;

		try {
			if (type === "airtime") {
				vtpassResult = await purchaseAirtime({
					serviceID,
					phone,
					amount,
					requestId,
				});
			} else {
				vtpassResult = await purchaseData({
					serviceID,
					phone,
					variationCode: variationCode!,
					requestId,
				});
			}
		} catch (error) {
			console.error("VTPass purchase error:", error);
			return NextResponse.json(
				{
					success: false,
					error: "Payment verified but VTPass fulfilment failed",
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

		const isVTPassSuccess =
			vtpassResult.code === "000" ||
			vtpassResult.content?.transactions?.status === "delivered";

		return NextResponse.json({
			success: isVTPassSuccess,
			message: isVTPassSuccess
				? `${type === "airtime" ? "Airtime" : "Data"} purchase successful!`
				: `VTPass returned status: ${vtpassResult.response_description}`,
			vtpass: {
				requestId,
				status:
					vtpassResult.content?.transactions?.status ||
					vtpassResult.code,
				productName:
					vtpassResult.content?.transactions?.product_name ||
					serviceID,
				transactionId:
					vtpassResult.content?.transactions?.transactionId || "",
				amount:
					vtpassResult.content?.transactions?.total_amount || amount,
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

	// ─── Flow B / C: Standard x402 facilitator flow (payment-signature) or 402 ───
	const gateResult = await gatePayment(request, paymentConfig);

	// If gatePayment returned a NextResponse, it's a 402 or error — pass through
	if (gateResult instanceof NextResponse) {
		return gateResult;
	}

	// ─── Step 5: Payment verified! Call VTPass ───
	const requestId = generateRequestId();

	let vtpassResult;
	try {
		if (type === "airtime") {
			vtpassResult = await purchaseAirtime({
				serviceID,
				phone,
				amount,
				requestId,
			});
		} else {
			vtpassResult = await purchaseData({
				serviceID,
				phone,
				variationCode: variationCode!,
				requestId,
			});
		}
	} catch (error) {
		console.error("VTPass purchase error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Payment was verified but VTPass fulfillment failed",
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

	// ─── Step 6: Return Success ───
	const isVTPassSuccess =
		vtpassResult.code === "000" ||
		vtpassResult.content?.transactions?.status === "delivered";

	const responseData = {
		success: isVTPassSuccess,
		message: isVTPassSuccess
			? `${type === "airtime" ? "Airtime" : "Data"} purchase successful!`
			: `VTPass returned status: ${vtpassResult.response_description}`,
		vtpass: {
			requestId,
			status:
				vtpassResult.content?.transactions?.status || vtpassResult.code,
			productName:
				vtpassResult.content?.transactions?.product_name || serviceID,
			transactionId:
				vtpassResult.content?.transactions?.transactionId || "",
			amount: vtpassResult.content?.transactions?.total_amount || amount,
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

	// Build response with payment-response header
	const response = NextResponse.json(responseData, { status: 200 });
	response.headers.set(
		"payment-response",
		buildPaymentResponseHeader(gateResult.settlement)
	);

	return response;
}
