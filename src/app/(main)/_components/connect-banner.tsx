"use client";

import { useWallet } from "@/lib/stacks-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ConnectBanner() {
	const { isConnected, connecting, connectWallet } = useWallet();

	if (isConnected) return null;

	return (
		<Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
			<CardContent className="flex flex-col items-center gap-3 py-6 text-center">
				<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
					Connect your Stacks wallet to pay for services with crypto
				</p>
				<Button onClick={connectWallet} disabled={connecting}>
					{connecting ? "Connecting..." : "Connect Wallet"}
				</Button>
			</CardContent>
		</Card>
	);
}
