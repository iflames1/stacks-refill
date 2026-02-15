"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { type PaymentRequirements, useWallet } from "@/lib/stacks-wallet";

import type {
	CryptoPrices,
	CryptoType,
	PurchaseResult,
	PurchaseStep,
	ServiceInfo,
	ServicePlan,
	ServiceProvider,
} from "./types";
import { CRYPTO_OPTIONS } from "./types";

interface PurchaseFormProps {
	service: ServiceInfo;
	prices: CryptoPrices | null;
	onBack: () => void;
	country: string;
	currencySymbol: string;
}

export function PurchaseForm({
	service,
	prices,
	onBack,
	country,
	currencySymbol,
}: PurchaseFormProps) {
	const { isConnected, payWithWallet } = useWallet();

	// ─── Form state ───
	const [provider, setProvider] = useState<ServiceProvider | null>(null);
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState<number>(0);
	const [customAmount, setCustomAmount] = useState("");
	const [cryptoType, setCryptoType] = useState<CryptoType>("STX");
	const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);

	// ─── Plans ───
	const [plans, setPlans] = useState<ServicePlan[]>([]);
	const [loadingPlans, setLoadingPlans] = useState(false);

	// ─── Purchase flow ───
	const [step, setStep] = useState<PurchaseStep>("idle");
	const [statusMessage, setStatusMessage] = useState("");
	const [result, setResult] = useState<PurchaseResult | null>(null);

	// ─── Verification state ───
	const [verifiedName, setVerifiedName] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationError, setVerificationError] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (service.type !== "tv" && service.type !== "electricity") return;

		setVerifiedName(null);
		setVerificationError(null);

		const cleanRecipient = recipient.trim();
		if (cleanRecipient.length < 9 || !provider) return;

		const timer = setTimeout(async () => {
			setIsVerifying(true);
			try {
				const res = await fetch("/api/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						serviceType: service.type,
						serviceID: provider.serviceID,
						recipient: cleanRecipient,
						variationCode: selectedPlan?.code,
						country,
					}),
				});

				const data = await res.json();
				if (data.success && data.name) {
					setVerifiedName(data.name);
				} else {
					setVerificationError(data.error || "Could not verify details");
				}
			} catch {
				setVerificationError("Verification request failed");
			} finally {
				setIsVerifying(false);
			}
		}, 800);

		return () => clearTimeout(timer);
	}, [recipient, provider, selectedPlan, service.type]);

	// ─── Fetch plans when provider changes ───
	useEffect(() => {
		if (!service.requiresPlan || !provider) return;

		const fetchPlans = async () => {
			setLoadingPlans(true);
			setPlans([]);
			setSelectedPlan(null);
			try {
				const res = await fetch(
					`/api/plans?serviceID=${provider.serviceID}&serviceType=${service.type}&country=${country}`,
				);
				const data = await res.json();
				if (data.success) setPlans(data.plans || []);
			} catch (err) {
				console.error("Failed to fetch plans:", err);
			} finally {
				setLoadingPlans(false);
			}
		};
		fetchPlans();
	}, [service, provider]);

	// ─── Calculations ───

	const getLocalAmount = (): number => {
		if (service.allowCustomAmount) return amount || Number(customAmount) || 0;
		if (service.requiresPlan) return selectedPlan ? selectedPlan.amount : 0;
		return 0;
	};

	const getCryptoAmount = (): string => {
		const local = getLocalAmount();
		if (!prices || local <= 0) return "0.00";

		const priceMap: Record<CryptoType, number> = {
			STX: prices.stx,
			sBTC: prices.sbtc,
			USDCx: prices.usdcx,
		};

		const tokenPrice = priceMap[cryptoType];
		if (!tokenPrice || tokenPrice <= 0) return "0.00";

		const base = local / tokenPrice;
		const withSlippage = base * 1.02;
		return withSlippage.toFixed(cryptoType === "sBTC" ? 8 : 6);
	};

	// ─── Purchase Flow ───

	const handlePurchase = async () => {
		if (!provider || !isConnected) return;
		const localAmount = getLocalAmount();
		if (localAmount <= 0 || !recipient) return;

		setResult(null);
		setStep("fetching-price");
		setStatusMessage("Calculating payment...");

		const body = {
			serviceType: service.type,
			serviceID: provider.serviceID,
			recipient: recipient.trim(),
			amount: localAmount,
			variationCode: selectedPlan?.code,
			cryptoType,
			country,
		};

		try {
			// Step 1 — get 402 with payment requirements
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
				setStatusMessage("Invalid payment data from server");
				return;
			}

			// Step 2 — wallet popup
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

			// Step 3 — server verification + fulfilment
			setStep("confirming");
			setStatusMessage("Verifying payment & delivering...");

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
				setStatusMessage(data.error || data.message || "Purchase failed");
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

	const isRecipientValid = recipient.trim().length >= 7;
	const localAmount = getLocalAmount();
	const isVerifiedIfRequired =
		service.type !== "tv" && service.type !== "electricity"
			? true
			: !!verifiedName;

	const canPurchase =
		isConnected &&
		isRecipientValid &&
		localAmount > 0 &&
		provider !== null &&
		(!service.requiresPlan || selectedPlan !== null) &&
		isVerifiedIfRequired &&
		step === "idle";

	const isProcessing =
		step === "fetching-price" ||
		step === "awaiting-wallet" ||
		step === "confirming";

	// ─── Render ───

	return (
		<Card className="shadow-lg">
			<CardHeader>
				<div className="flex items-center gap-3">
					<button
						onClick={onBack}
						className="text-muted-foreground hover:text-foreground text-lg transition-colors"
						aria-label="Back to services"
					>
						←
					</button>
					<div className="flex items-center gap-2">
						<span className="text-2xl">{service.icon}</span>
						<div>
							<CardTitle>{service.name}</CardTitle>
							<CardDescription className="text-xs">
								{service.description}
							</CardDescription>
						</div>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* ─── Provider Selection ─── */}
				<div>
					<Label className="mb-2 block text-sm font-medium">
						Select Provider
					</Label>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{service.providers.map((p) => (
							<Button
								key={p.id}
								variant={provider?.id === p.id ? "default" : "outline"}
								size="sm"
								className="w-full"
								onClick={() => {
									setProvider(p);
									setSelectedPlan(null);
									setPlans([]);
								}}
							>
								{p.logo && <span className="mr-1.5">{p.logo}</span>}
								{p.name}
							</Button>
						))}
					</div>
				</div>

				{/* ─── Plan Selection ─── */}
				{service.requiresPlan && provider && (
					<div>
						<Label className="mb-2 block text-sm font-medium">
							Select Plan
						</Label>
						{loadingPlans ? (
							<div className="text-muted-foreground flex items-center justify-center py-8">
								<span className="mr-2 animate-spin">⏳</span>
								Loading plans...
							</div>
						) : plans.length === 0 ? (
							<p className="text-muted-foreground py-4 text-center text-sm">
								No plans available for {provider.name}
							</p>
						) : (
							<div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
								{plans.map((plan) => (
									<button
										key={plan.code}
										className={`hover:border-primary/50 rounded-lg border p-3 text-left transition-all ${
											selectedPlan?.code === plan.code
												? "border-primary bg-primary/5 ring-primary ring-1"
												: "border-border"
										}`}
										onClick={() => setSelectedPlan(plan)}
									>
										<p className="text-sm leading-tight font-medium">
											{plan.name}
										</p>
										<p className="text-primary mt-1 font-bold">
											{currencySymbol}
											{plan.amount.toLocaleString()}
										</p>
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* ─── Amount Selection ─── */}
				{service.allowCustomAmount && (
					<div>
						<Label className="mb-2 block text-sm font-medium">
							Amount ({currencySymbol})
						</Label>
						{service.quickAmounts && (
							<div className="mb-3 grid grid-cols-3 gap-2">
								{service.quickAmounts.map((a) => (
									<Button
										key={a}
										variant={
											amount === a && !customAmount ? "default" : "outline"
										}
										size="sm"
										onClick={() => {
											setAmount(a);
											setCustomAmount("");
										}}
									>
										{currencySymbol}
										{a.toLocaleString()}
									</Button>
								))}
							</div>
						)}
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-sm">or</span>
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
				)}

				<Separator />

				{/* ─── Recipient ─── */}
				<div>
					<Label htmlFor="recipient" className="mb-2 block text-sm font-medium">
						{service.recipientLabel}
					</Label>
					<Input
						id="recipient"
						type="text"
						placeholder={service.recipientPlaceholder}
						value={recipient}
						onChange={(e) => setRecipient(e.target.value)}
						className={
							recipient && !isRecipientValid ? "border-destructive" : ""
						}
					/>
					{recipient && !isRecipientValid && (
						<p className="text-destructive mt-1 text-xs">
							Enter a valid {service.recipientLabel.toLowerCase()}
						</p>
					)}

					{/* ─── Verification Result ─── */}
					{(service.type === "tv" || service.type === "electricity") && (
						<div className="mt-2 text-sm">
							{isVerifying && (
								<p className="text-muted-foreground flex items-center gap-2">
									<span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
									Verifying ID...
								</p>
							)}
							{!isVerifying && verifiedName && (
								<p className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
									✅ {verifiedName}
								</p>
							)}
							{!isVerifying && verificationError && recipient.length >= 10 && (
								<p className="text-destructive flex items-center gap-2">
									❌ {verificationError}
								</p>
							)}
						</div>
					)}
				</div>

				<Separator />

				{/* ─── Crypto Selection ─── */}
				<div>
					<Label className="mb-2 block text-sm font-medium">Pay With</Label>
					<RadioGroup
						value={cryptoType}
						onValueChange={(v) => setCryptoType(v as CryptoType)}
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
								<span className="text-xl">{c.icon}</span>
								<span className="text-sm font-semibold">{c.label}</span>
								<span className="text-muted-foreground text-xs">{c.desc}</span>
							</Label>
						))}
					</RadioGroup>
				</div>

				{/* ─── Summary ─── */}
				{localAmount > 0 && prices && (
					<>
						<Separator />
						<div className="bg-muted/50 space-y-2 rounded-lg p-4">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									{service.requiresPlan ? "Plan" : "Amount"}
								</span>
								<span className="font-medium">
									{currencySymbol}
									{localAmount.toLocaleString()}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">{cryptoType} Rate</span>
								<span className="font-medium">
									{currencySymbol}
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
								<span className="text-muted-foreground">Slippage Buffer</span>
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

				{step === "idle" && (
					<Button
						onClick={handlePurchase}
						disabled={!canPurchase}
						className="h-12 w-full text-base font-semibold"
						size="lg"
					>
						{!isConnected
							? "Connect Wallet to Pay"
							: !provider
								? "Select a Provider"
								: `Pay ${getCryptoAmount()} ${cryptoType}`}
					</Button>
				)}

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
									Check your wallet extension for the transaction approval
								</p>
							)}
							{step === "confirming" && (
								<p className="text-muted-foreground text-center text-xs">
									Verifying on Stacks blockchain & delivering your service...
								</p>
							)}
						</CardContent>
					</Card>
				)}

				{step === "success" && result && (
					<Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
						<CardHeader className="pb-2">
							<CardTitle className="text-base text-green-700 dark:text-green-400">
								✅ {result.message}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{result.fulfilment && (
								<div className="space-y-1">
									<p>
										<span className="text-muted-foreground">Product:</span>{" "}
										{result.fulfilment.productName}
									</p>
									<p>
										<span className="text-muted-foreground">Ref:</span>{" "}
										{result.fulfilment.transactionId}
									</p>
									<p>
										<span className="text-muted-foreground">Status:</span>{" "}
										<Badge
											variant={
												result.fulfilment.status === "delivered"
													? "default"
													: "secondary"
											}
										>
											{result.fulfilment.status}
										</Badge>
									</p>
								</div>
							)}
							{result.payment && (
								<div className="mt-2 space-y-1">
									<p>
										<span className="text-muted-foreground">Paid:</span>{" "}
										{result.payment.cryptoAmount} {result.payment.cryptoType}
									</p>
									{result.payment.txId && (
										<p>
											<span className="text-muted-foreground">Tx:</span>{" "}
											<a
												href={`https://explorer.hiro.so/txid/${result.payment.txId}?chain=${result.payment.network || "mainnet"}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary break-all underline underline-offset-2"
											>
												{result.payment.txId.slice(0, 12)}
												...
												{result.payment.txId.slice(-8)}
											</a>
										</p>
									)}
								</div>
							)}
							<div className="flex gap-2 pt-3">
								<Button
									onClick={resetPurchase}
									variant="outline"
									className="flex-1"
								>
									Buy Again
								</Button>
								<Button onClick={onBack} variant="ghost" className="flex-1">
									All Services
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

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
										{result.payment.txId.slice(0, 16)}...
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
	);
}
