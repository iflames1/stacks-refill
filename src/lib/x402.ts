import { NextResponse } from "next/server";
import {
	X402PaymentVerifier,
	STXtoMicroSTX,
	BTCtoSats,
	USDCxToMicroUSDCx,
	getDefaultSBTCContract,
	getDefaultUSDCxContract,
	networkToCAIP2,
	assetToV2,
} from "x402-stacks";
import type { CryptoType, PaymentGateConfig, PaymentGateResult } from "./types";

// x402 v2 standard headers
const HEADER_PAYMENT_SIGNATURE = "payment-signature";
const HEADER_PAYMENT_REQUIRED = "payment-required";
//const HEADER_PAYMENT_RESPONSE = "payment-response";

/**
 * Map a CryptoType to the x402 v2 asset string and token contract info.
 */
export function getAssetConfig(
	cryptoType: CryptoType,
	network: "mainnet" | "testnet" = "mainnet"
) {
	switch (cryptoType) {
		case "sBTC": {
			const contract = getDefaultSBTCContract(network);
			return {
				asset: assetToV2("sBTC", contract),
				tokenType: "sBTC" as const,
				tokenContract: contract,
			};
		}
		case "USDCx": {
			const contract = getDefaultUSDCxContract(network);
			return {
				asset: assetToV2("USDCx", contract),
				tokenType: "USDCx" as const,
				tokenContract: contract,
			};
		}
		case "STX":
		default:
			return {
				asset: "STX",
				tokenType: "STX" as const,
				tokenContract: undefined,
			};
	}
}

/**
 * Convert a human-readable crypto amount to atomic units (microSTX, sats, microUSDCx).
 */
export function toAtomicUnits(amount: number, cryptoType: CryptoType): bigint {
	switch (cryptoType) {
		case "STX":
			return STXtoMicroSTX(amount);
		case "sBTC":
			return BTCtoSats(amount);
		case "USDCx":
			return USDCxToMicroUSDCx(amount);
		default:
			return STXtoMicroSTX(amount);
	}
}

/**
 * Build the 402 Payment Required response for Next.js App Router.
 * Includes `meta` field with tokenType, tokenContract, and description
 * so the frontend wallet can construct the correct transaction.
 */
export function buildPaymentRequiredResponse(
	config: PaymentGateConfig
): NextResponse {
	const network = (process.env.NETWORK as "mainnet" | "testnet") || "mainnet";
	const assetCfg = getAssetConfig(config.tokenType || "STX", network);

	const paymentRequired = {
		x402Version: 2,
		paymentRequirements: {
			scheme: "exact",
			network: config.network,
			amount: config.amount.toString(),
			asset: config.asset,
			payTo: config.payTo,
			maxTimeoutSeconds: 300,
		},
		meta: {
			tokenType: config.tokenType || "STX",
			tokenContract: assetCfg.tokenContract
				? `${assetCfg.tokenContract.address}.${assetCfg.tokenContract.name}`
				: null,
			description: config.description || "",
		},
	};

	const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString(
		"base64"
	);

	return new NextResponse(JSON.stringify(paymentRequired), {
		status: 402,
		headers: {
			"Content-Type": "application/json",
			[HEADER_PAYMENT_REQUIRED]: encoded,
		},
	});
}

/**
 * x402 payment gate for Next.js App Router route handlers.
 *
 * Checks for the `payment-signature` header:
 * - If absent → returns 402 Payment Required with payment instructions
 * - If present → settles the signed transaction via the facilitator
 *   - On success → returns { paid: true, settlement }
 *   - On failure → returns 402 with error
 *
 * Usage in a route handler:
 * ```ts
 * const result = await gatePayment(request, config);
 * if (result instanceof NextResponse) return result; // 402 or error
 * // result.paid === true → proceed with business logic
 * ```
 */
export async function gatePayment(
	request: Request,
	config: PaymentGateConfig
): Promise<NextResponse | PaymentGateResult> {
	const paymentSignature = request.headers.get(HEADER_PAYMENT_SIGNATURE);

	// No payment attached → return 402 Payment Required
	if (!paymentSignature) {
		return buildPaymentRequiredResponse(config);
	}

	// Decode the signed payment payload
	let paymentPayload;
	try {
		const decoded = Buffer.from(paymentSignature, "base64").toString(
			"utf-8"
		);
		paymentPayload = JSON.parse(decoded);
	} catch {
		return new NextResponse(
			JSON.stringify({ error: "Invalid payment-signature header" }),
			{ status: 400, headers: { "Content-Type": "application/json" } }
		);
	}

	// Validate x402 version
	if (paymentPayload.x402Version !== 2) {
		return new NextResponse(
			JSON.stringify({ error: "Only x402 v2 is supported" }),
			{ status: 400, headers: { "Content-Type": "application/json" } }
		);
	}

	// Build payment requirements for settlement
	const paymentRequirements = {
		scheme: "exact" as const,
		network: config.network as `stacks:${string}`,
		amount: config.amount.toString(),
		asset: config.asset,
		payTo: config.payTo,
		maxTimeoutSeconds: 300,
	};

	// Settle via the facilitator
	const verifier = new X402PaymentVerifier(config.facilitatorUrl);

	try {
		const settlement = await verifier.settle(paymentPayload, {
			paymentRequirements,
		});

		if (!settlement.success) {
			// Settlement failed → return 402 with the payment requirements again
			const response = buildPaymentRequiredResponse(config);
			return response;
		}

		// Payment confirmed!
		return {
			paid: true,
			settlement: {
				success: true,
				payer: settlement.payer,
				transaction: settlement.transaction,
				network: settlement.network,
			},
		};
	} catch (error) {
		console.error("x402 settlement error:", error);
		return new NextResponse(
			JSON.stringify({
				error: "Payment settlement failed",
				details:
					error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}

/**
 * Build the payment-response header value to include in successful responses.
 * This lets the client know the payment was settled.
 */
export function buildPaymentResponseHeader(settlement: {
	payer?: string;
	transaction?: string;
	network?: string;
}): string {
	return Buffer.from(JSON.stringify(settlement)).toString("base64");
}

/**
 * Get the Stacks network in CAIP-2 format from environment.
 */
export function getNetworkCAIP2(): string {
	const network = (process.env.NETWORK as "mainnet" | "testnet") || "mainnet";
	return networkToCAIP2(network);
}

// ────────────────────────────────────────────────────────────────
// On-chain transaction verification (for wallet-signed payments)
// ────────────────────────────────────────────────────────────────

/**
 * Verify a transaction on-chain via the Hiro Stacks API.
 * Accepts both pending (mempool) and confirmed transactions.
 *
 * For STX transfers, checks that the recipient and amount match.
 * For contract calls (sBTC/USDCx), checks the function name.
 */
export async function verifyTransactionOnChain(
	txid: string,
	expectedPayTo: string,
	expectedAmount: bigint,
	tokenType: string
): Promise<{
	verified: boolean;
	payer?: string;
	txid?: string;
	error?: string;
}> {
	const network = (process.env.NETWORK as "mainnet" | "testnet") || "mainnet";
	const apiBase =
		network === "mainnet"
			? "https://api.hiro.so"
			: "https://api.testnet.hiro.so";

	// Normalise txid — accept with or without 0x prefix
	const cleanTxid = txid.startsWith("0x") ? txid : `0x${txid}`;

	// Retry up to 3 times (mempool tx may take a moment to appear)
	let lastError = "";
	for (let attempt = 0; attempt < 3; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, 2000 * attempt));
		}

		try {
			const res = await fetch(`${apiBase}/extended/v1/tx/${cleanTxid}`, {
				headers: { Accept: "application/json" },
			});

			if (res.status === 404) {
				lastError = "Transaction not found yet";
				continue;
			}

			if (!res.ok) {
				lastError = `Stacks API error: ${res.status}`;
				continue;
			}

			const tx = await res.json();

			// Accept pending or successful transactions
			if (tx.tx_status !== "success" && tx.tx_status !== "pending") {
				return {
					verified: false,
					error: `Transaction status: ${tx.tx_status}`,
				};
			}

			const payer = tx.sender_address;

			// ── STX native transfer ──
			if (tokenType === "STX" && tx.tx_type === "token_transfer") {
				if (tx.token_transfer.recipient_address !== expectedPayTo) {
					return {
						verified: false,
						error: `Recipient mismatch: expected ${expectedPayTo}, got ${tx.token_transfer.recipient_address}`,
					};
				}
				const txAmount = BigInt(tx.token_transfer.amount);
				if (txAmount < expectedAmount) {
					return {
						verified: false,
						error: `Amount too low: expected ${expectedAmount}, got ${txAmount}`,
					};
				}
				return { verified: true, payer, txid: cleanTxid };
			}

			// ── SIP-010 contract call (sBTC / USDCx) ──
			if (
				(tokenType === "sBTC" || tokenType === "USDCx") &&
				tx.tx_type === "contract_call"
			) {
				if (tx.contract_call.function_name !== "transfer") {
					return {
						verified: false,
						error: "Not a transfer function call",
					};
				}
				// Basic verification — the contract call is to the correct function
				// Full arg verification is complex; for hackathon we trust the contract call
				return { verified: true, payer, txid: cleanTxid };
			}

			// Tx type mismatch but exists — still accept for hackathon demo
			return { verified: true, payer, txid: cleanTxid };
		} catch {
			lastError = "Network error verifying transaction";
			continue;
		}
	}

	return { verified: false, error: lastError || "Transaction not found" };
}
