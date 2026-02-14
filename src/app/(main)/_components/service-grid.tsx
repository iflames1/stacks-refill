"use client";

import { Badge } from "@/components/ui/badge";
import type { ServiceInfo, ComingSoon } from "./types";

interface ServiceGridProps {
	services: ServiceInfo[];
	comingSoon: ComingSoon[];
	loading: boolean;
	onSelect: (service: ServiceInfo) => void;
}

export function ServiceGrid({
	services,
	comingSoon,
	loading,
	onSelect,
}: ServiceGridProps) {
	if (loading) {
		return (
			<div className="text-muted-foreground flex items-center justify-center py-16">
				Loading services...
			</div>
		);
	}

	return (
		<>
			{/* Available Services */}
			<h2 className="mb-4 text-lg font-semibold">Services</h2>
			<div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
				{services.map((svc) => (
					<button
						key={svc.type}
						onClick={() => onSelect(svc)}
						className="hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center gap-2 rounded-xl border bg-white p-6 text-center shadow-sm transition-all dark:bg-gray-900"
					>
						<span className="text-3xl">{svc.icon}</span>
						<span className="text-sm font-semibold">
							{svc.name}
						</span>
						<span className="text-muted-foreground text-xs leading-tight">
							{svc.description}
						</span>
					</button>
				))}
			</div>

			{/* Coming Soon */}
			{comingSoon.length > 0 && (
				<>
					<h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wider">
						Coming Soon
					</h2>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						{comingSoon.map((svc) => (
							<div
								key={svc.type}
								className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-white/50 p-6 text-center opacity-60 dark:bg-gray-900/50"
							>
								<span className="text-3xl grayscale">
									{svc.icon}
								</span>
								<span className="text-sm font-semibold">
									{svc.name}
								</span>
								<Badge variant="outline" className="text-xs">
									Coming Soon
								</Badge>
							</div>
						))}
					</div>
				</>
			)}
		</>
	);
}
