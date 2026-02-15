"use client";

import Image from "next/image";
import Link from "next/link";
import { History } from "lucide-react";
import { useWallet } from "@/lib/stacks-wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function truncAddr(addr: string) {
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SiteHeader() {
	const {
		isConnected,
		stxAddress,
		connecting,
		connectWallet,
		disconnectWallet,
	} = useWallet();

	return (
		<header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80">
			<div className="container mx-auto flex items-center justify-between px-4 py-4">
				<Link
					href="/"
					className="flex items-center gap-3 transition-opacity hover:opacity-80"
				>
					<Image
						src="/logo.png"
						alt="Stacks Refill"
						width={40}
						height={40}
						className="rounded-lg"
						priority
					/>
					<div>
						<h1 className="text-xl font-bold tracking-tight">
							Stacks Refill
						</h1>
						<p className="text-muted-foreground text-xs">
							Pay subscriptions & bills with crypto
						</p>
					</div>
				</Link>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild>
						<Link
							href="/transactions"
							className="flex items-center gap-2"
						>
							<History className="h-4 w-4" />
							<span className="hidden sm:inline">History</span>
						</Link>
					</Button>

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
