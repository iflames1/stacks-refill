"use client";

import { ArrowLeft, ExternalLink, History } from "lucide-react";
import Link from "next/link";
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
import { useTransactionHistory } from "@/hooks/use-transaction-history";

export default function TransactionsPage() {
	const { transactions, isLoaded } = useTransactionHistory();

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
						<div className="text-muted-foreground py-8 text-center">
							Loading history...
						</div>
					) : transactions.length === 0 ? (
						<div className="py-12 text-center">
							<History className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-20" />
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
											<TableCell className="text-xs whitespace-nowrap">
												{new Date(
													tx.date
												).toLocaleDateString("en-GB", {
													day: "2-digit",
													month: "short",
													year: "numeric",
												})}{" "}
												<span className="text-muted-foreground block opacity-70">
													{new Date(
														tx.date
													).toLocaleTimeString(
														"en-US",
														{
															hour: "2-digit",
															minute: "2-digit",
														}
													)}
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
