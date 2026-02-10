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
            <body style={{ display: 'flex' }}>
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
            </body>
        </html>
    );
}
