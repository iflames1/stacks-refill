// ════════════════════════════════════════════════════════════════
// Aggregator & Service abstraction types
// ════════════════════════════════════════════════════════════════

/**
 * All supported service categories.
 * New service types are added here first.
 */
export type ServiceType =
	| "airtime"
	| "data"
	| "tv"
	| "electricity"
	| "education";

/**
 * ISO 3166-1 alpha-2 country codes we support.
 * Extend as new aggregators bring more countries.
 */
export type CountryCode = "NG" | "GH" | "KE" | "ZA" | "US" | "GB";

/**
 * A provider within a service — e.g. MTN, Airtel for airtime.
 */
export interface ServiceProvider {
	id: string; // unique across the aggregator, e.g. "mtn"
	name: string; // display name, e.g. "MTN"
	serviceID: string; // aggregator-specific ID, e.g. "mtn" for VTPass airtime
	logo?: string; // optional URL or emoji
}

/**
 * A selectable plan / variation within a service.
 * Used for data bundles, TV packages, education pins, etc.
 */
export interface ServicePlan {
	code: string; // variation code
	name: string; // display name
	amount: number; // price in local currency
	currency: string; // e.g. "NGN"
	description?: string;
}

/**
 * Params passed to an aggregator to fulfil a purchase.
 */
export interface FulfillmentRequest {
	serviceType: ServiceType;
	serviceID: string; // aggregator-specific service ID
	recipient: string; // phone number, meter number, smart card, etc.
	amount: number; // local currency amount
	variationCode?: string; // for plans/bundles
	requestId?: string; // idempotency key
	extras?: Record<string, string>; // aggregator-specific fields
}

/**
 * Standardised result returned from any aggregator after fulfilment.
 */
export interface FulfillmentResult {
	success: boolean;
	transactionId: string;
	status: "delivered" | "pending" | "failed";
	productName: string;
	amount: number;
	currency: string;
	rawResponse?: unknown; // original aggregator response for debugging
}

/**
 * Metadata about an aggregator.
 */
export interface AggregatorInfo {
	/** Unique slug, e.g. "vtpass" */
	id: string;
	/** Display name, e.g. "VTPass" */
	name: string;
	/** Website URL */
	website: string;
	/** Countries this aggregator covers */
	countries: CountryCode[];
	/** Service types this aggregator can handle */
	serviceTypes: ServiceType[];
	/** Human description */
	description: string;
}

/**
 * The interface every aggregator must implement.
 *
 * To add a new aggregator:
 * 1. Create `src/lib/aggregators/<name>.ts`
 * 2. Export a class implementing `Aggregator`
 * 3. Register it in `src/lib/aggregators/registry.ts`
 *
 * See `src/lib/aggregators/vtpass.ts` for the reference implementation.
 */
export interface Aggregator {
	/** Static metadata about this aggregator */
	info: AggregatorInfo;

	/**
	 * Return available providers for a service type.
	 * e.g. for "airtime" in NG → [MTN, Airtel, Glo, 9mobile]
	 */
	getProviders(
		serviceType: ServiceType,
		country: CountryCode
	): Promise<ServiceProvider[]>;

	/**
	 * Return available plans/variations for a specific provider+service.
	 * Returns empty array for services without plans (e.g. airtime).
	 */
	getPlans(serviceID: string): Promise<ServicePlan[]>;

	/**
	 * Fulfil a purchase. Called after payment has been verified.
	 */
	fulfil(request: FulfillmentRequest): Promise<FulfillmentResult>;

	/**
	 * Validate a recipient identifier (phone, meter, smartcard, etc.)
	 * Returns true if the format is valid for the given service.
	 */
	validateRecipient(recipient: string, serviceType: ServiceType): boolean;
}
