import { getDashboardMetrics, getRecentBookings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics();
    const recentBookings = await getRecentBookings();

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '6rem' }}>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-4px', textTransform: 'uppercase' }}>Overview</h1>
            </div>

            {/* Metrics Grid */}
            <div className="metrics-grid">
                <div className="glass-card">
                    <div className="metric-content">
                        <p className="metric-label">Total Bookings</p>
                        <h2 className="metric-value">{metrics.totalBookings}</h2>
                    </div>
                </div>
                <div className="glass-card">
                    <div className="metric-content">
                        <p className="metric-label">Active Customers</p>
                        <h2 className="metric-value">{metrics.activeCustomers}</h2>
                    </div>
                </div>
                <div className="glass-card">
                    <div className="metric-content">
                        <p className="metric-label">Estimated Revenue</p>
                        <h2 className="metric-value" style={{ fontSize: metrics.estimatedRevenue === 'Error' ? '2.5rem' : '4.2rem' }}>
                            {metrics.estimatedRevenue}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Recent Bookings Section */}
            <div style={{ marginTop: '5rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '3.5rem' }}>Recent Bookings</h3>
                <div className="table-wrap">
                    {recentBookings.length === 0 ? (
                        <div style={{ padding: '5rem', textAlign: 'center', opacity: 0.5 }}>
                            <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>No recent bookings found</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Start Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBookings.map((booking: any) => (
                                    <tr key={booking.id}>
                                        <td style={{ fontWeight: 800 }}>{booking.id.substring(0, 8).toUpperCase()}</td>
                                        <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{new Date(booking.startAt).toLocaleString()}</td>
                                        <td>
                                            <span style={{
                                                padding: '8px 18px',
                                                borderRadius: '100px',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                fontSize: '0.75rem',
                                                fontWeight: 900,
                                                color: 'var(--accent)',
                                                textTransform: 'uppercase'
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
        </div>
    );
}
