import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
    title: "Square Professional Dashboard",
    description: "Premium dashboard for Square Bookings",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="flex">
                <Sidebar />
                <main style={{ marginLeft: '250px', width: 'calc(100% - 250px)' }}>
                    {children}
                </main>
            </body>
        </html>
    );
}
