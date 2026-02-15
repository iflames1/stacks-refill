"use client";

import Link from "next/link";
import { useTransactionHistory } from "@/hooks/use-transaction-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useWallet } from "@/lib/stacks-wallet";
import { ExternalLink, ArrowLeft, History } from "lucide-react";

export default function TransactionsPage() {
	const { isConnected } = useWallet();
	const { transactions, isLoaded } = useTransactionHistory();

	if (!isConnected) {
		return (
			<div className="container mx-auto max-w-3xl px-4 py-16 text-center">
				<History className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-20" />
				<h1 className="text-2xl font-bold">Connect Wallet</h1>
				<p className="text-muted-foreground mt-2">
					Please connect your wallet to view your local transaction
					history.
				</p>
				<Button asChild className="mt-6">
					<Link href="/">Back to Home</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1 className="text-2xl font-bold">Transaction History</h1>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Recent Activity</CardTitle>
					<CardDescription>
						Your last {transactions.length} transactions saved
						locally on this device.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!isLoaded ? (
						<div className="py-8 text-center text-muted-foreground">
							Loading history...
						</div>
					) : transactions.length === 0 ? (
						<div className="py-12 text-center">
							<History className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-20" />
							<p className="text-muted-foreground">
								No transactions found.
							</p>
							<Button asChild variant="outline" className="mt-4">
								<Link href="/">Buy Airtime or Data</Link>
							</Button>
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Date</TableHead>
										<TableHead>Service</TableHead>
										<TableHead>Recipient</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">
											Action
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{transactions.map((tx) => (
										<TableRow key={tx.id}>
											<TableCell className="whitespace-nowrap text-xs">
												{new Date(
													tx.date
												).toLocaleDateString()}{" "}
												<span className="text-muted-foreground block opacity-70">
													{new Date(
														tx.date
													).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</TableCell>
											<TableCell>
												<span className="font-medium">
													{tx.productName}
												</span>
												<Badge
													variant="outline"
													className="ml-2 hidden text-[10px] capitalize sm:inline-flex"
												>
													{tx.serviceType}
												</Badge>
											</TableCell>
											<TableCell className="font-mono text-xs">
												{tx.recipient}
											</TableCell>
											<TableCell>
												<div className="font-medium">
													{tx.amount}{" "}
													<span className="text-[10px]">
														{tx.currency}
													</span>
												</div>
												<div className="text-muted-foreground text-[10px]">
													{tx.cryptoAmount}{" "}
													{tx.cryptoType}
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant={
														tx.status ===
														"delivered"
															? "default"
															: tx.status ===
																  "pending"
																? "secondary"
																: "destructive"
													}
													className="text-[10px]"
												>
													{tx.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												{tx.txId && (
													<Button
														variant="ghost"
														size="icon"
														asChild
														title="View on Explorer"
													>
														<a
															href={`https://explorer.hiro.so/txid/${tx.txId}?chain=mainnet`}
															target="_blank"
															rel="noopener noreferrer"
														>
															<ExternalLink className="h-4 w-4" />
														</a>
													</Button>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
