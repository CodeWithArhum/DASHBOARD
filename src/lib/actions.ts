'use server';

import { square } from './square';

export interface DashboardMetrics {
    totalBookings: number;
    activeCustomers: number;
    estimatedRevenue: string; // Formatted currency
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
        // 1. Fetch recent bookings (last 30 days usually, but let's just get latest 100 for overview)
        // Note: In a real app, you'd calculate dates.
        const bookingsResponse = await square.bookingsApi.listBookings(100);

        const bookings = bookingsResponse.result.bookings || [];
        const totalBookings = bookings.length; // This is just the fetched count, not total in DB. sufficient for MVP.

        // 2. Fetch Customers
        const customersResponse = await square.customersApi.listCustomers(undefined, 100);
        const customers = customersResponse.result.customers || [];
        const activeCustomers = customers.length;

        // 3. Calculate Revenue (Very rough estimate based on bookings if possible, or just a placeholder)
        // Real revenue requires Orders API linked to Bookings.
        // For now, we'll return a placeholder or calculate based on loaded bookings if they have price.
        // Most booking objects don't directly have price unless extended.

        return {
            totalBookings,
            activeCustomers,
            estimatedRevenue: "$0.00" // Placeholder until we link Orders
        };

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        return {
            totalBookings: 0,
            activeCustomers: 0,
            estimatedRevenue: "Error"
        };
    }
}

export async function getRecentBookings() {
    try {
        const response = await square.bookingsApi.listBookings(5);
        // Serialize QueryBigInt issues if any (Next.js server actions limitation with BigInt)
        // Square IDs are strings, but some fields might be BigInt.
        // JSON.parse(JSON.stringify) is a hack but works for simple objects.
        return JSON.parse(JSON.stringify(response.result.bookings || []));
    } catch (error) {
        console.error("Error fetching recent bookings:", error);
        return [];
    }
}

export async function getBookings() {
    try {
        const response = await square.bookingsApi.listBookings(100);
        return JSON.parse(JSON.stringify(response.result.bookings || []));
    } catch (error) {
        console.error("Error fetching bookings:", error);
        return [];
    }
}
