import { getDashboardMetrics, getRecentBookings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics();
    const recentBookings = await getRecentBookings();

    return (
        <div className="container animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Dashboard</h1>
                    <p className="text-muted">Overview of your bookings and performance.</p>
                </div>
                <button className="glass-panel" style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', color: 'white' }}>
                    + New Booking
                </button>
            </header>

            {/* Metrics Grid */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: '3rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <p className="text-muted text-sm">Total Bookings (Last 100)</p>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{metrics.totalBookings}</h2>
                    <p className="text-success text-sm">Live Data</p>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <p className="text-muted text-sm">Revenue (Est.)</p>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{metrics.estimatedRevenue}</h2>
                    <p className="text-muted text-sm">Requires Order Sync</p>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <p className="text-muted text-sm">Active Customers</p>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{metrics.activeCustomers}</h2>
                    <p className="text-success text-sm">Returning</p>
                </div>
            </div>

            {/* Recent Activity Section */}
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Recent Bookings</h3>
            <div className="glass-panel" style={{ padding: '0' }}>
                {recentBookings.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary)' }}>
                        <p>No recent bookings found.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>ID</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Start Time</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings.map((booking: any) => (
                                <tr key={booking.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td style={{ padding: '1rem' }}>{booking.id.substring(0, 8)}...</td>
                                    <td style={{ padding: '1rem' }}>{new Date(booking.startAt).toLocaleString()}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            background: booking.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                            color: booking.status === 'ACCEPTED' ? '#10b981' : 'inherit'
                                        }}>
                                            {booking.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
