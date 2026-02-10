import { getBookings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
    const bookings = await getBookings();

    return (
        <div className="container animate-fade-in">
            <header className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Bookings</h1>
                    <p className="text-muted">Manage your appointments.</p>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                {bookings.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary)' }}>
                        <p>No bookings found.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>ID</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Start Time</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Duration</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Status</th>
                                <th style={{ padding: '1rem', color: 'var(--secondary)' }}>Customer Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map((booking: any) => (
                                <tr key={booking.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{booking.id.substring(0, 8)}...</td>
                                    <td style={{ padding: '1rem' }}>{new Date(booking.startAt).toLocaleString()}</td>
                                    <td style={{ padding: '1rem' }}>{booking.appointmentSegments?.[0]?.durationMinutes} min</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            background: booking.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' :
                                                booking.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.2)' :
                                                    'rgba(255, 255, 255, 0.1)',
                                            color: booking.status === 'ACCEPTED' ? '#10b981' :
                                                booking.status === 'CANCELLED' ? '#ef4444' :
                                                    'inherit'
                                        }}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--secondary)' }}>
                                        {booking.customerNote || '-'}
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
