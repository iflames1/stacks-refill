"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocalTransaction } from "@/lib/types";

const STORAGE_KEY = "stacks-refill-history";

export function useTransactionHistory() {
	const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	const saveToStorage = (data: LocalTransaction[]): LocalTransaction[] => {
		if (typeof window === "undefined") return data;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			return data;
		} catch (e) {
			if (
				e instanceof DOMException &&
				(e.name === "QuotaExceededError" ||
					e.name === "NS_ERROR_DOM_QUOTA_REACHED")
			) {
				console.warn("Storage quota exceeded. Trimming history...");
				const keepCount = Math.floor(data.length * 0.8);

				if (keepCount > 0 && keepCount < data.length) {
					const trimmed = data.slice(0, keepCount);
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
						return trimmed;
					} catch (retryErr) {
						console.error("Failed to save even after trimming:", retryErr);
					}
				}
			} else {
				console.error("Failed to save transaction history:", e);
			}
		}
		return data;
	};

	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				setTransactions(JSON.parse(stored));
			}
		} catch (err) {
			console.error("Failed to load transaction history:", err);
		}
		setIsLoaded(true);
	}, []);

	const addTransaction = useCallback((tx: LocalTransaction) => {
		setTransactions((prev) => {
			const newHistory = [tx, ...prev];
			return saveToStorage(newHistory);
		});
	}, []);

	const clearHistory = useCallback(() => {
		if (typeof window !== "undefined") {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch (err) {
				console.error("Failed to clear history:", err);
			}
		}
		setTransactions([]);
	}, []);

	return {
		transactions,
		addTransaction,
		clearHistory,
		isLoaded,
	};
}
