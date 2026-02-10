'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, Users, Settings } from 'lucide-react';

const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/bookings', label: 'Bookings', icon: Calendar },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside style={{
            width: '250px',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            borderRight: '1px solid var(--card-border)',
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(10px)',
            padding: '2rem 1rem',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ marginBottom: '3rem', paddingLeft: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Square Admin</h2>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                color: isActive ? 'white' : 'var(--secondary)',
                                background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
