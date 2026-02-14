"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, type PaymentRequirements } from "@/lib/stacks-wallet";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───

type CryptoType = "STX" | "sBTC" | "USDCx";
type NetworkProvider = "mtn" | "airtel" | "glo" | "etisalat";

interface DataPlan {
	variation_code: string;
	name: string;
	variation_amount: string;
	fixedPrice: string;
}

interface CryptoPrices {
	stx: number;
	sbtc: number;
	usdcx: number;
}

interface PurchaseResult {
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
	details?: string;
}

type PurchaseStep =
	| "idle"
	| "fetching-price"
	| "awaiting-wallet"
	| "confirming"
	| "success"
	| "error";

// ─── Constants ───

const PROVIDERS: Record<NetworkProvider, { name: string; color: string }> = {
	mtn: { name: "MTN", color: "bg-yellow-500" },
	airtel: { name: "Airtel", color: "bg-red-500" },
	glo: { name: "Glo", color: "bg-green-600" },
	etisalat: { name: "9mobile", color: "bg-emerald-500" },
};

const CRYPTO_OPTIONS: {
	value: CryptoType;
	label: string;
	icon: string;
	desc: string;
}[] = [
	{ value: "STX", label: "STX", icon: "⚡", desc: "Stacks" },
	{ value: "sBTC", label: "sBTC", icon: "₿", desc: "Bitcoin on Stacks" },
	{ value: "USDCx", label: "USDCx", icon: "💲", desc: "USDC on Stacks" },
];

const AIRTIME_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ─── Main Component ───

export default function Home() {
	const {
		isConnected,
		stxAddress,
		connecting,
		connectWallet,
		disconnectWallet,
		payWithWallet,
	} = useWallet();

	// Form state
	const [serviceType, setServiceType] = useState<"airtime" | "data">(
		"airtime"
	);
	const [provider, setProvider] = useState<NetworkProvider>("mtn");
	const [phone, setPhone] = useState("");
	const [amount, setAmount] = useState<number>(0);
	const [customAmount, setCustomAmount] = useState("");
	const [cryptoType, setCryptoType] = useState<CryptoType>("STX");
	const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);

	// Data
	const [prices, setPrices] = useState<CryptoPrices | null>(null);
	const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);

	// UI state
	const [loadingPrices, setLoadingPrices] = useState(false);
	const [loadingPlans, setLoadingPlans] = useState(false);
	const [step, setStep] = useState<PurchaseStep>("idle");
	const [statusMessage, setStatusMessage] = useState("");
	const [result, setResult] = useState<PurchaseResult | null>(null);

	// ─── Fetch Prices ───
	const fetchPrices = useCallback(async () => {
		setLoadingPrices(true);
		try {
			const res = await fetch("/api/prices");
			const data = await res.json();
			if (data.success) {
				setPrices(data.prices);
			}
		} catch (err) {
			console.error("Failed to fetch prices:", err);
		} finally {
			setLoadingPrices(false);
		}
	}, []);

	useEffect(() => {
		fetchPrices();
		// Refresh prices every 600 seconds
		const interval = setInterval(fetchPrices, 600_000);
		return () => clearInterval(interval);
	}, [fetchPrices]);

	// ─── Fetch Data Plans ───
	useEffect(() => {
		if (serviceType !== "data") return;

		const fetchPlans = async () => {
			setLoadingPlans(true);
			setDataPlans([]);
			setSelectedPlan(null);
			try {
				const serviceID = `${provider}-data`;
				const res = await fetch(`/api/plans?serviceID=${serviceID}`);
				const data = await res.json();
				if (data.success) {
					setDataPlans(data.plans);
				}
			} catch (err) {
				console.error("Failed to fetch plans:", err);
			} finally {
				setLoadingPlans(false);
			}
		};

		fetchPlans();
	}, [serviceType, provider]);

	// ─── Calculate Crypto Amount ───
	const getNGNAmount = (): number => {
		if (serviceType === "airtime") {
			return amount || Number(customAmount) || 0;
		}
		return selectedPlan ? Number(selectedPlan.variation_amount) : 0;
	};

	const getCryptoAmount = (): string => {
		const ngn = getNGNAmount();
		if (!prices || ngn <= 0) return "0.00";

		const priceMap: Record<CryptoType, number> = {
			STX: prices.stx,
			sBTC: prices.sbtc,
			USDCx: prices.usdcx,
		};

		const tokenPrice = priceMap[cryptoType];
		if (!tokenPrice || tokenPrice <= 0) return "0.00";

		const baseAmount = ngn / tokenPrice;
		const withSlippage = baseAmount * 1.02; // 2% slippage buffer
		return withSlippage.toFixed(cryptoType === "sBTC" ? 8 : 6);
	};

	// ─── Handle Purchase (Wallet Flow) ───
	const handlePurchase = async () => {
		const ngnAmount = getNGNAmount();
		if (ngnAmount <= 0 || !phone || !isConnected) return;

		setResult(null);
		setStep("fetching-price");
		setStatusMessage("Getting current price & payment details...");

		const serviceID =
			serviceType === "airtime" ? provider : `${provider}-data`;

		const body = {
			type: serviceType,
			serviceID,
			phone: phone.trim(),
			amount: ngnAmount,
			variationCode: selectedPlan?.variation_code,
			cryptoType,
		};

		try {
			// ─── Step 1: Get 402 with payment requirements ───
			const res402 = await fetch("/api/purchase", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res402.status !== 402) {
				const errData = await res402.json();
				setStep("error");
				setStatusMessage(errData.error || "Unexpected response");
				setResult({
					success: false,
					message: errData.error || "Request failed",
					error: errData.error,
				});
				return;
			}

			const paymentData = await res402.json();
			const reqs = paymentData.paymentRequirements;
			const meta = paymentData.meta;

			if (!reqs) {
				setStep("error");
				setStatusMessage("Invalid payment requirements from server");
				return;
			}

			// ─── Step 2: Prompt wallet for payment ───
			setStep("awaiting-wallet");
			setStatusMessage("Confirm the transaction in your wallet...");

			const walletReqs: PaymentRequirements = {
				amount: reqs.amount,
				asset: reqs.asset,
				payTo: reqs.payTo,
				network: reqs.network,
				tokenType: meta?.tokenType || cryptoType,
				tokenContract: meta?.tokenContract || undefined,
			};

			let txid: string;
			try {
				txid = await payWithWallet(walletReqs);
			} catch (walletErr) {
				setStep("error");
				const msg =
					walletErr instanceof Error
						? walletErr.message
						: "Wallet transaction cancelled";
				setStatusMessage(msg);
				setResult({
					success: false,
					message: "Transaction cancelled",
					error: msg,
				});
				return;
			}

			// ─── Step 3: Confirm payment with server ───
			setStep("confirming");
			setStatusMessage(
				"Payment sent! Verifying transaction & delivering..."
			);

			const confirmRes = await fetch("/api/purchase", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-payment-txid": txid,
				},
				body: JSON.stringify(body),
			});

			const data: PurchaseResult = await confirmRes.json();

			if (data.success) {
				setStep("success");
				setStatusMessage("Purchase successful!");
			} else {
				setStep("error");
				setStatusMessage(
					data.error || data.message || "Purchase failed"
				);
			}
			setResult(data);
		} catch (err) {
			setStep("error");
			const msg = err instanceof Error ? err.message : "Network error";
			setStatusMessage(msg);
			setResult({
				success: false,
				message: "Network error",
				error: msg,
			});
		}
	};

	const resetPurchase = () => {
		setStep("idle");
		setStatusMessage("");
		setResult(null);
	};

	// ─── Validation ───
	const isPhoneValid = /^(\+?234|0)[789]\d{9}$/.test(
		phone.replace(/\s|-/g, "")
	);
	const ngnAmount = getNGNAmount();
	const canPurchase =
		isConnected &&
		isPhoneValid &&
		ngnAmount > 0 &&
		(serviceType === "airtime" || selectedPlan !== null) &&
		step === "idle";

	const isProcessing =
		step === "fetching-price" ||
		step === "awaiting-wallet" ||
		step === "confirming";

	const truncAddr = (addr: string) =>
		`${addr.slice(0, 6)}...${addr.slice(-4)}`;

	return (
		<main className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80">
				<div className="container mx-auto flex items-center justify-between px-4 py-4">
					<div className="flex items-center gap-3">
						<div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold">
							SR
						</div>
						<div>
							<h1 className="text-xl font-bold tracking-tight">
								Stacks Refill
							</h1>
							<p className="text-muted-foreground text-xs">
								Buy Airtime & Data with Crypto
							</p>
						</div>
					</div>

					{/* Wallet Connect Button */}
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="hidden sm:flex">
							x402 Protocol
						</Badge>
						{isConnected ? (
							<div className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className="font-mono text-xs"
								>
									{truncAddr(stxAddress!)}
								</Badge>
								<Button
									variant="outline"
									size="sm"
									onClick={disconnectWallet}
								>
									Disconnect
								</Button>
							</div>
						) : (
							<Button
								onClick={connectWallet}
								disabled={connecting}
								size="sm"
							>
								{connecting
									? "Connecting..."
									: "Connect Wallet"}
							</Button>
						)}
					</div>
				</div>
			</header>

			<div className="container mx-auto max-w-2xl px-4 py-8">
				{/* Not connected banner */}
				{!isConnected && (
					<Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
						<CardContent className="flex flex-col items-center gap-3 py-6 text-center">
							<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
								Connect your Stacks wallet to buy airtime & data
								with crypto
							</p>
							<Button
								onClick={connectWallet}
								disabled={connecting}
							>
								{connecting
									? "Connecting..."
									: "Connect Wallet"}
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Price Ticker */}
				{prices && (
					<div className="mb-6 flex flex-wrap justify-center gap-3">
						{CRYPTO_OPTIONS.map((c) => {
							const priceMap: Record<CryptoType, number> = {
								STX: prices.stx,
								sBTC: prices.sbtc,
								USDCx: prices.usdcx,
							};
							return (
								<Badge
									key={c.value}
									variant="secondary"
									className="px-3 py-1 text-sm"
								>
									{c.icon} 1 {c.label} = ₦
									{priceMap[c.value]?.toLocaleString() || "—"}
								</Badge>
							);
						})}
						{loadingPrices && (
							<Badge variant="outline" className="animate-pulse">
								Updating...
							</Badge>
						)}
					</div>
				)}

				{/* Main Card */}
				<Card className="shadow-lg">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl">
							Refill Your Phone
						</CardTitle>
						<CardDescription>
							Pay with STX, sBTC, or USDCx — powered by x402 on
							Stacks
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						{/* Service Type Tabs */}
						<Tabs
							value={serviceType}
							onValueChange={(v) => {
								setServiceType(v as "airtime" | "data");
								setAmount(0);
								setCustomAmount("");
								setSelectedPlan(null);
								resetPurchase();
							}}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="airtime">
									📱 Airtime
								</TabsTrigger>
								<TabsTrigger value="data">📶 Data</TabsTrigger>
							</TabsList>

							{/* ─── Network Provider ─── */}
							<div className="mt-4">
								<Label className="mb-2 block text-sm font-medium">
									Network Provider
								</Label>
								<div className="grid grid-cols-4 gap-2">
									{(
										Object.entries(PROVIDERS) as [
											NetworkProvider,
											{ name: string; color: string },
										][]
									).map(([key, val]) => (
										<Button
											key={key}
											variant={
												provider === key
													? "default"
													: "outline"
											}
											size="sm"
											className="w-full"
											onClick={() => {
												setProvider(key);
												setSelectedPlan(null);
											}}
										>
											<span
												className={`mr-1.5 inline-block h-2 w-2 rounded-full ${val.color}`}
											/>
											{val.name}
										</Button>
									))}
								</div>
							</div>

							{/* ─── Airtime Tab ─── */}
							<TabsContent
								value="airtime"
								className="mt-4 space-y-4"
							>
								<div>
									<Label className="mb-2 block text-sm font-medium">
										Amount (₦)
									</Label>
									<div className="mb-3 grid grid-cols-3 gap-2">
										{AIRTIME_AMOUNTS.map((a) => (
											<Button
												key={a}
												variant={
													amount === a &&
													!customAmount
														? "default"
														: "outline"
												}
												size="sm"
												onClick={() => {
													setAmount(a);
													setCustomAmount("");
												}}
											>
												₦{a.toLocaleString()}
											</Button>
										))}
									</div>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground text-sm">
											or
										</span>
										<Input
											type="number"
											placeholder="Custom amount"
											value={customAmount}
											onChange={(e) => {
												setCustomAmount(e.target.value);
												setAmount(0);
											}}
											min={50}
											max={50000}
										/>
									</div>
								</div>
							</TabsContent>

							{/* ─── Data Tab ─── */}
							<TabsContent
								value="data"
								className="mt-4 space-y-4"
							>
								<div>
									<Label className="mb-2 block text-sm font-medium">
										Select Data Plan
									</Label>
									{loadingPlans ? (
										<div className="text-muted-foreground flex items-center justify-center py-8">
											<span className="mr-2 animate-spin">
												⏳
											</span>{" "}
											Loading plans...
										</div>
									) : dataPlans.length === 0 ? (
										<p className="text-muted-foreground py-4 text-center text-sm">
											No plans available for{" "}
											{PROVIDERS[provider].name}
										</p>
									) : (
										<div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
											{dataPlans.map((plan) => (
												<button
													key={plan.variation_code}
													className={`hover:border-primary/50 rounded-lg border p-3 text-left transition-all ${
														selectedPlan?.variation_code ===
														plan.variation_code
															? "border-primary bg-primary/5 ring-primary ring-1"
															: "border-border"
													}`}
													onClick={() =>
														setSelectedPlan(plan)
													}
												>
													<p className="text-sm leading-tight font-medium">
														{plan.name}
													</p>
													<p className="text-primary mt-1 font-bold">
														₦
														{Number(
															plan.variation_amount
														).toLocaleString()}
													</p>
												</button>
											))}
										</div>
									)}
								</div>
							</TabsContent>
						</Tabs>

						<Separator />

						{/* ─── Phone Number ─── */}
						<div>
							<Label
								htmlFor="phone"
								className="mb-2 block text-sm font-medium"
							>
								Phone Number
							</Label>
							<Input
								id="phone"
								type="tel"
								placeholder="08012345678"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								className={
									phone && !isPhoneValid
										? "border-destructive"
										: ""
								}
							/>
							{phone && !isPhoneValid && (
								<p className="text-destructive mt-1 text-xs">
									Enter a valid Nigerian phone number
								</p>
							)}
						</div>

						<Separator />

						{/* ─── Crypto Selection ─── */}
						<div>
							<Label className="mb-2 block text-sm font-medium">
								Pay With
							</Label>
							<RadioGroup
								value={cryptoType}
								onValueChange={(v) =>
									setCryptoType(v as CryptoType)
								}
								className="grid grid-cols-3 gap-3"
							>
								{CRYPTO_OPTIONS.map((c) => (
									<Label
										key={c.value}
										htmlFor={c.value}
										className={`hover:border-primary/50 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all ${
											cryptoType === c.value
												? "border-primary bg-primary/5"
												: "border-border"
										}`}
									>
										<RadioGroupItem
											value={c.value}
											id={c.value}
											className="sr-only"
										/>
										<span className="text-xl">
											{c.icon}
										</span>
										<span className="text-sm font-semibold">
											{c.label}
										</span>
										<span className="text-muted-foreground text-xs">
											{c.desc}
										</span>
									</Label>
								))}
							</RadioGroup>
						</div>

						{/* ─── Summary ─── */}
						{ngnAmount > 0 && prices && (
							<>
								<Separator />
								<div className="bg-muted/50 space-y-2 rounded-lg p-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											{serviceType === "airtime"
												? "Airtime Amount"
												: "Data Plan"}
										</span>
										<span className="font-medium">
											₦{ngnAmount.toLocaleString()}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											{cryptoType} Rate
										</span>
										<span className="font-medium">
											₦
											{(cryptoType === "STX"
												? prices.stx
												: cryptoType === "sBTC"
													? prices.sbtc
													: prices.usdcx
											)?.toLocaleString()}
											/{cryptoType}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Slippage Buffer
										</span>
										<span className="font-medium">2%</span>
									</div>
									<Separator />
									<div className="flex justify-between font-bold">
										<span>You Pay</span>
										<span className="text-primary">
											{getCryptoAmount()} {cryptoType}
										</span>
									</div>
								</div>
							</>
						)}

						{/* ─── Purchase Flow States ─── */}

						{/* Idle: show pay button */}
						{step === "idle" && (
							<Button
								onClick={handlePurchase}
								disabled={!canPurchase}
								className="h-12 w-full text-base font-semibold"
								size="lg"
							>
								{!isConnected
									? "Connect Wallet to Pay"
									: `Pay ${getCryptoAmount()} ${cryptoType}`}
							</Button>
						)}

						{/* Processing states */}
						{isProcessing && (
							<Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
								<CardContent className="flex flex-col items-center gap-3 py-6">
									<div className="relative flex h-12 w-12 items-center justify-center">
										<div className="border-primary absolute inset-0 animate-spin rounded-full border-2 border-t-transparent" />
										<span className="text-xl">
											{step === "fetching-price"
												? "💰"
												: step === "awaiting-wallet"
													? "👛"
													: "✅"}
										</span>
									</div>
									<p className="text-center text-sm font-medium text-blue-700 dark:text-blue-400">
										{statusMessage}
									</p>
									{step === "awaiting-wallet" && (
										<p className="text-muted-foreground text-center text-xs">
											Check your wallet extension for the
											transaction approval
										</p>
									)}
									{step === "confirming" && (
										<p className="text-muted-foreground text-center text-xs">
											Verifying on Stacks blockchain &
											delivering to phone...
										</p>
									)}
								</CardContent>
							</Card>
						)}

						{/* Success Result */}
						{step === "success" && result && (
							<Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
								<CardHeader className="pb-2">
									<CardTitle className="text-base text-green-700 dark:text-green-400">
										✅ {result.message}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2 text-sm">
									{result.vtpass && (
										<div className="space-y-1">
											<p>
												<span className="text-muted-foreground">
													Product:
												</span>{" "}
												{result.vtpass.productName}
											</p>
											<p>
												<span className="text-muted-foreground">
													VTPass ID:
												</span>{" "}
												{result.vtpass.transactionId}
											</p>
											<p>
												<span className="text-muted-foreground">
													Status:
												</span>{" "}
												<Badge
													variant={
														result.vtpass.status ===
														"delivered"
															? "default"
															: "secondary"
													}
												>
													{result.vtpass.status}
												</Badge>
											</p>
										</div>
									)}
									{result.payment && (
										<div className="mt-2 space-y-1">
											<p>
												<span className="text-muted-foreground">
													Paid:
												</span>{" "}
												{result.payment.cryptoAmount}{" "}
												{result.payment.cryptoType}
											</p>
											{result.payment.txId && (
												<p>
													<span className="text-muted-foreground">
														Tx:
													</span>{" "}
													<a
														href={`https://explorer.hiro.so/txid/${result.payment.txId}?chain=${result.payment.network || "mainnet"}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-primary break-all underline underline-offset-2"
													>
														{result.payment.txId.slice(
															0,
															12
														)}
														...
														{result.payment.txId.slice(
															-8
														)}
													</a>
												</p>
											)}
											{result.payment.payer && (
												<p>
													<span className="text-muted-foreground">
														From:
													</span>{" "}
													<span className="font-mono text-xs break-all">
														{result.payment.payer}
													</span>
												</p>
											)}
										</div>
									)}
									<div className="pt-3">
										<Button
											onClick={resetPurchase}
											variant="outline"
											className="w-full"
										>
											Make Another Purchase
										</Button>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Error Result */}
						{step === "error" && (
							<Card className="border-destructive/50 bg-red-50 dark:bg-red-950/20">
								<CardHeader className="pb-2">
									<CardTitle className="text-destructive text-base">
										❌ {result?.message || statusMessage}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2 text-sm">
									{(result?.error || result?.details) && (
										<p className="text-destructive text-xs">
											{result.details || result.error}
										</p>
									)}
									{result?.payment?.txId && (
										<p className="text-xs">
											Tx:{" "}
											<a
												href={`https://explorer.hiro.so/txid/${result.payment.txId}?chain=mainnet`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary underline"
											>
												{result.payment.txId.slice(
													0,
													16
												)}
												...
											</a>
										</p>
									)}
									<div className="pt-3">
										<Button
											onClick={resetPurchase}
											variant="outline"
											className="w-full"
										>
											Try Again
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</CardContent>
				</Card>

				{/* Footer */}
				<footer className="text-muted-foreground mt-8 space-y-1 text-center text-sm">
					<p>
						Built for the{" "}
						<span className="font-semibold">
							x402 Stacks Challenge
						</span>{" "}
						Hackathon
					</p>
					<p>
						Payments via{" "}
						<a
							href="https://docs.x402stacks.xyz"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2"
						>
							x402-stacks
						</a>{" "}
						• Wallet via{" "}
						<a
							href="https://docs.stacks.co/reference/stacks.js/stacks-connect"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2"
						>
							Stacks Connect
						</a>{" "}
						• Fulfillment via{" "}
						<a
							href="https://vtpass.com"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2"
						>
							VTPass
						</a>{" "}
						• Prices via{" "}
						<a
							href="https://coingecko.com"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2"
						>
							CoinGecko
						</a>
					</p>
				</footer>
			</div>
		</main>
	);
}
