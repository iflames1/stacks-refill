import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Stacks Refill — Buy Nigerian Airtime & Data with Crypto",
	description:
		"Pay for Nigerian airtime and data bundles using STX, sBTC, or USDCx on the Stacks blockchain. Powered by x402 protocol.",
	keywords: [
		"stacks",
		"STX",
		"sBTC",
		"USDCx",
		"airtime",
		"data",
		"Nigeria",
		"crypto",
		"x402",
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
