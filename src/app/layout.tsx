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
	metadataBase: new URL("https://stacksrefill.com"),
	title: {
		default: "Stacks Refill — Pay Bills & Subscriptions with Crypto",
		template: "%s | Stacks Refill",
	},
	description:
		"Buy airtime, data bundles, TV subscriptions, electricity tokens and more using STX, sBTC, or USDCx on the Stacks blockchain.",
	keywords: [
		"Stacks Refill",
		"crypto payments",
		"pay bills with crypto",
		"STX",
		"sBTC",
		"USDCx",
		"airtime",
		"data bundles",
		"TV subscription",
		"electricity",
		"Stacks blockchain",
		"Nigeria",
		"global subscriptions",
	],
	authors: [{ name: "Stacks Refill" }],
	creator: "Stacks Refill",
	publisher: "Stacks Refill",
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://stacksrefill.com",
		siteName: "Stacks Refill",
		title: "Stacks Refill — Pay Bills & Subscriptions with Crypto",
		description:
			"Pay for airtime, data, TV, electricity and more with STX, sBTC, or USDCx. Fast, global, on-chain.",
		images: [
			{
				url: "/logo.png",
				width: 1200,
				height: 630,
				alt: "Stacks Refill — Pay Bills & Subscriptions with Crypto",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Stacks Refill — Pay Bills & Subscriptions with Crypto",
		description:
			"Pay for airtime, data, TV, electricity and more with STX, sBTC, or USDCx on the Stacks blockchain.",
		creator: "@stacksrefill",
		images: ["/logo.png"],
	},
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: [{ url: "/apple-icon.png" }],
	},
	manifest: "/site.webmanifest",
	applicationName: "Stacks Refill",
	category: "Finance",
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
