"use client";

import { useQuery } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import { api } from "@/lib/axios";
import type { ProductRow, ScanResult } from "@/server/products.service";

export type CustomerSearchResult = { id: string; name: string; phone: string | null };

export function useProductSearch(query: string, categoryId: string | null) {
  return useQuery<ProductRow[]>({
    queryKey: ["products", "search", query, categoryId],
    staleTime: 15_000,
    placeholderData: (previousData) => previousData,
    queryFn: async ({ signal }): Promise<ProductRow[]> => {
      const response: AxiosResponse<{ products: ProductRow[] }> = await api.get("/products/search", { params: { q: query, ...(categoryId ? { category: categoryId } : {}) }, signal });
      return response.data.products;
    },
  });
}

export function useCustomerSearch(query: string) {
  return useQuery<CustomerSearchResult[]>({
    queryKey: ["customers", "search", query],
    enabled: query.trim().length > 0,
    queryFn: async ({ signal }): Promise<CustomerSearchResult[]> => {
      const response: AxiosResponse<{ customers: CustomerSearchResult[] }> = await api.get("/customers/search", { params: { q: query }, signal });
      return response.data.customers;
    },
  });
}

export async function scanCode(code: string): Promise<ScanResult> {
  const response: AxiosResponse<{ result: ScanResult }> = await api.get("/products/scan", { params: { code } });
  return response.data.result;
}
