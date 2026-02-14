export function SiteFooter() {
	return (
		<footer className="border-t bg-white/50 dark:bg-gray-950/50">
			<div className="container mx-auto px-4 py-6">
				<div className="text-muted-foreground space-y-1 text-center text-sm">
					<p>
						<span className="font-semibold">Stacks Refill</span> —
						Pay for subscriptions & bills with crypto on Stacks
					</p>
					<p>
						Built on{" "}
						<a
							href="https://www.stacks.co"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground underline underline-offset-2"
						>
							Stacks
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
				</div>
			</div>
		</footer>
	);
}
