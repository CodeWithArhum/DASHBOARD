'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Zap, BookMarked, Users } from 'lucide-react';
import AlmatiqLogo from './AlmatiqLogo';

const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/leads', label: 'Leads Hub', icon: Zap },
    { href: '/bookings', label: 'Bookings', icon: BookMarked },
    { href: '/customers', label: 'Customers', icon: Users },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="logo-container">
                <AlmatiqLogo />
            </div>

            <nav>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} className={item.label === 'Leads Hub' ? 'text-accent' : ''} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
