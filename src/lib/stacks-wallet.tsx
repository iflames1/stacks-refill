"use client";

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
} from "react";

// ─── Dynamic imports to avoid SSR module errors ───
// @stacks/connect and @stacks/transactions are browser-only
const getStacksConnect = () => import("@stacks/connect");
const getStacksTransactions = () => import("@stacks/transactions");

// ─── Types ───

interface WalletContextType {
	isConnected: boolean;
	stxAddress: string | null;
	connecting: boolean;
	connectWallet: () => Promise<void>;
	disconnectWallet: () => void;
	payWithWallet: (paymentReqs: PaymentRequirements) => Promise<string>;
}

export interface PaymentRequirements {
	amount: string; // atomic units (microSTX, sats, micro-USDCx)
	asset: string; // "STX" or contract identifier
	payTo: string; // recipient Stacks address
	network: string; // CAIP-2 e.g. "stacks:1"
	tokenType: string; // "STX", "sBTC", "USDCx"
	tokenContract?: string; // e.g. "SM3VDX...sbtc-token" for SIP-010 tokens
}

// ─── Network Helper ───

const STACKS_NETWORK =
	(process.env.NEXT_PUBLIC_NETWORK as "mainnet" | "testnet") || "mainnet";

// ─── Context ───

const WalletContext = createContext<WalletContextType>({
	isConnected: false,
	stxAddress: null,
	connecting: false,
	connectWallet: async () => {},
	disconnectWallet: () => {},
	payWithWallet: async () => "",
});

// ─── Provider ───

export function WalletProvider({ children }: { children: ReactNode }) {
	const [isConnected, setIsConnected] = useState(false);
	const [stxAddress, setStxAddress] = useState<string | null>(null);
	const [connecting, setConnecting] = useState(false);

	// Restore connection state on mount
	useEffect(() => {
		(async () => {
			try {
				const { isConnected: checkConnected, getLocalStorage } =
					await getStacksConnect();
				if (checkConnected()) {
					setIsConnected(true);
					const data = getLocalStorage();
					const addr = data?.addresses?.stx?.[0]?.address;
					if (addr) setStxAddress(addr);
				}
			} catch {
				// @stacks/connect may throw if no provider; ignore on mount
			}
		})();
	}, []);

	const connectWallet = useCallback(async () => {
		setConnecting(true);
		try {
			const { connect, getLocalStorage } = await getStacksConnect();
			await connect();
			setIsConnected(true);
			const data = getLocalStorage();
			const addr = data?.addresses?.stx?.[0]?.address;
			if (addr) setStxAddress(addr);
		} catch (err) {
			console.error("Wallet connect failed:", err);
			throw err;
		} finally {
			setConnecting(false);
		}
	}, []);

	const disconnectWallet = useCallback(async () => {
		const { disconnect } = await getStacksConnect();
		disconnect();
		setIsConnected(false);
		setStxAddress(null);
	}, []);

	/**
	 * Execute a payment via the connected wallet.
	 * - STX: uses stx_transferStx
	 * - sBTC / USDCx: uses stx_callContract (SIP-010 transfer)
	 *
	 * Returns the transaction ID.
	 */
	const payWithWallet = useCallback(
		async (reqs: PaymentRequirements): Promise<string> => {
			if (!stxAddress) throw new Error("Wallet not connected");

			const { request } = await getStacksConnect();
			const { Cl } = await getStacksTransactions();

			if (reqs.tokenType === "STX") {
				// ─── Native STX Transfer ───
				const response = await request("stx_transferStx", {
					amount: reqs.amount,
					recipient: reqs.payTo,
					memo: "Stacks Refill x402",
					network: STACKS_NETWORK,
				});
				if (!response.txid)
					throw new Error("No txid returned from wallet");
				return response.txid;
			}

			// ─── SIP-010 Token Transfer (sBTC / USDCx) ───
			const contract = reqs.tokenContract || reqs.asset;
			if (!contract || !contract.includes(".")) {
				throw new Error(
					`Invalid token contract for ${reqs.tokenType}: ${contract}`
				);
			}

			const response = await request("stx_callContract", {
				contract: contract as `${string}.${string}`,
				functionName: "transfer",
				functionArgs: [
					Cl.uint(BigInt(reqs.amount)),
					Cl.principal(stxAddress),
					Cl.principal(reqs.payTo),
					Cl.none(), // no memo
				],
				network: STACKS_NETWORK,
			});
			if (!response.txid) throw new Error("No txid returned from wallet");
			return response.txid;
		},
		[stxAddress]
	);

	return (
		<WalletContext.Provider
			value={{
				isConnected,
				stxAddress,
				connecting,
				connectWallet,
				disconnectWallet,
				payWithWallet,
			}}
		>
			{children}
		</WalletContext.Provider>
	);
}

// ─── Hook ───

export function useWallet() {
	return useContext(WalletContext);
}
