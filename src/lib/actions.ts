'use server';

import { square } from './square';

export interface DashboardMetrics {
    totalBookings: number;
    activeCustomers: number;
    estimatedRevenue: string; // Formatted currency
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
        if (!process.env.SQUARE_ACCESS_TOKEN) {
            throw new Error("Missing SQUARE_ACCESS_TOKEN Environment Variable");
        }

        const bookingsResponse = await square.bookingsApi.listBookings(100);
        const bookings = bookingsResponse.result.bookings || [];
        const totalBookings = bookings.length;

        const customersResponse = await square.customersApi.listCustomers(undefined, 100);
        const customers = customersResponse.result.customers || [];
        const activeCustomers = customers.length;

        return {
            totalBookings,
            activeCustomers,
            estimatedRevenue: "$0.00"
        };

    } catch (error: any) {
        console.error("Dashboard Data Fetch Error:", error);

        // Return a more descriptive error if it's an API error
        let errorMessage = "Error";
        if (error.result?.errors?.[0]?.detail) {
            errorMessage = error.result.errors[0].detail;
        } else if (error.message) {
            errorMessage = error.message;
        }

        return {
            totalBookings: 0,
            activeCustomers: 0,
            estimatedRevenue: errorMessage
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
