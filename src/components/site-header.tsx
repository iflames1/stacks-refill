"use client";

import { useWallet } from "@/lib/stacks-wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function truncAddr(addr: string) {
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SiteHeader() {
	const { isConnected, stxAddress, connecting, connectWallet, disconnectWallet } =
		useWallet();

	return (
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
							Pay subscriptions & bills with crypto
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
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
							{connecting ? "Connecting..." : "Connect Wallet"}
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
