"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocalTransaction } from "@/lib/types";

const STORAGE_KEY = "stacks-refill-history";

export function useTransactionHistory() {
	const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setTransactions(JSON.parse(stored));
			} catch (err) {
				console.error("Failed to parse transaction history:", err);
			}
		}
		setIsLoaded(true);
	}, []);

	const addTransaction = useCallback((tx: LocalTransaction) => {
		setTransactions((prev) => {
			const updated = [tx, ...prev];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
			return updated;
		});
	}, []);

	const clearHistory = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setTransactions([]);
	}, []);

	return {
		transactions,
		addTransaction,
		clearHistory,
		isLoaded,
	};
}
