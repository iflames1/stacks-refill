/**
 * Aggregator Registry & Service Catalogue
 *
 * This is the central place where:
 * 1. All aggregators are registered
 * 2. Service types are defined with metadata
 * 3. Lookups resolve which aggregator handles a given service + country
 *
 * ─── Adding a new aggregator ───
 * 1. Implement the `Aggregator` interface in `src/lib/aggregators/<name>.ts`
 * 2. Import and instantiate it below
 * 3. Add it to the `aggregators` array
 * That's it — the registry auto-maps services and countries.
 *
 * ─── Adding a new service type ───
 * 1. Add the type to `ServiceType` in `types.ts`
 * 2. Add metadata in `SERVICE_CATALOGUE` below
 * 3. Ensure at least one aggregator's `info.serviceTypes` includes it
 */

import type { Aggregator, CountryCode, ServiceType } from "./types";
import { VTPassAggregator } from "./vtpass";

// ─── Service Catalogue ───

export interface ServiceMeta {
	type: ServiceType;
	name: string;
	description: string;
	icon: string;
	/** Label for the recipient input field */
	recipientLabel: string;
	/** Placeholder text for the recipient input */
	recipientPlaceholder: string;
	/** Whether this service requires selecting a plan/variation */
	requiresPlan: boolean;
	/** Whether this service allows a custom freeform amount */
	allowCustomAmount: boolean;
	/** Suggested quick-pick amounts in local currency (if allowCustomAmount) */
	quickAmounts?: number[];
}

/**
 * Master catalogue of all service types.
 * UI reads this to render the service grid.
 */
export const SERVICE_CATALOGUE: ServiceMeta[] = [
	{
		type: "airtime",
		name: "Airtime",
		description: "Top up any mobile phone with airtime credit",
		icon: "📱",
		recipientLabel: "Phone Number",
		recipientPlaceholder: "08012345678",
		requiresPlan: false,
		allowCustomAmount: true,
		quickAmounts: [100, 200, 500, 1000, 2000, 5000],
	},
	{
		type: "data",
		name: "Data Bundle",
		description: "Buy mobile data plans for any network",
		icon: "📶",
		recipientLabel: "Phone Number",
		recipientPlaceholder: "08012345678",
		requiresPlan: true,
		allowCustomAmount: false,
	},
	{
		type: "tv",
		name: "TV Subscription",
		description: "Renew DStv, GOtv, StarTimes & more",
		icon: "📺",
		recipientLabel: "Smart Card / IUC Number",
		recipientPlaceholder: "1234567890",
		requiresPlan: true,
		allowCustomAmount: false,
	},
	{
		type: "electricity",
		name: "Electricity",
		description: "Pay electricity bills & buy prepaid tokens",
		icon: "⚡",
		recipientLabel: "Meter Number",
		recipientPlaceholder: "12345678901",
		requiresPlan: true,
		allowCustomAmount: true,
		quickAmounts: [1000, 2000, 5000, 10000, 20000],
	},
	{
		type: "education",
		name: "Education",
		description: "WAEC, NECO, JAMB result checker PINs",
		icon: "🎓",
		recipientLabel: "Phone / Profile Code",
		recipientPlaceholder: "08012345678",
		requiresPlan: true,
		allowCustomAmount: false,
	},
];

// ─── Aggregator Instances ───
// Add new aggregator instances here.

const aggregators: Aggregator[] = [new VTPassAggregator()];

// ─── Registry Lookups ───

/**
 * Get all registered aggregators.
 */
export function getAllAggregators(): Aggregator[] {
	return aggregators;
}

/**
 * Find an aggregator by its ID.
 */
export function getAggregator(id: string): Aggregator | undefined {
	return aggregators.find((a) => a.info.id === id);
}

/**
 * Get the best aggregator for a service type + country.
 * Currently returns the first match; can be extended with priority logic.
 */
export function getAggregatorFor(
	serviceType: ServiceType,
	country: CountryCode
): Aggregator | undefined {
	return aggregators.find(
		(a) =>
			a.info.serviceTypes.includes(serviceType) &&
			a.info.countries.includes(country)
	);
}

/**
 * Get all countries that have at least one aggregator for a service type.
 */
export function getCountriesForService(
	serviceType: ServiceType
): CountryCode[] {
	const countries = new Set<CountryCode>();
	for (const agg of aggregators) {
		if (agg.info.serviceTypes.includes(serviceType)) {
			for (const c of agg.info.countries) countries.add(c);
		}
	}
	return [...countries];
}

/**
 * Check if a service type is currently available (has at least one aggregator).
 */
export function isServiceAvailable(serviceType: ServiceType): boolean {
	return aggregators.some((a) => a.info.serviceTypes.includes(serviceType));
}

/**
 * Return service catalogue entries split into available and coming soon.
 */
export function getServiceAvailability(): {
	available: ServiceMeta[];
	comingSoon: ServiceMeta[];
} {
	const available: ServiceMeta[] = [];
	const comingSoon: ServiceMeta[] = [];

	// Only airtime and data are active for MVP
	const activeTypes: ServiceType[] = [
		"airtime",
		"data",
		"tv",
		"electricity",
		"education",
	];

	for (const svc of SERVICE_CATALOGUE) {
		if (activeTypes.includes(svc.type) && isServiceAvailable(svc.type)) {
			available.push(svc);
		} else {
			comingSoon.push(svc);
		}
	}

	return { available, comingSoon };
}

/**
 * Get service metadata by type.
 */
export function getServiceMeta(
	serviceType: ServiceType
): ServiceMeta | undefined {
	return SERVICE_CATALOGUE.find((s) => s.type === serviceType);
}
