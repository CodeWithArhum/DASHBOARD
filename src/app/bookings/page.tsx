import { getBookings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
    const bookings = await getBookings();

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '6rem' }}>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-4px', textTransform: 'uppercase' }}>Bookings</h1>
            </div>

            <div className="table-wrap">
                {bookings.length === 0 ? (
                    <div style={{ padding: '5rem', textAlign: 'center', opacity: 0.5 }}>
                        <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>No bookings found</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Start Time</th>
                                <th>Duration</th>
                                <th>Status</th>
                                <th>Customer Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map((booking: any) => (
                                <tr key={booking.id}>
                                    <td style={{ fontWeight: 800 }}>{booking.id.substring(0, 8).toUpperCase()}</td>
                                    <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{new Date(booking.startAt).toLocaleString()}</td>
                                    <td>{booking.appointmentSegments?.[0]?.durationMinutes} min</td>
                                    <td>
                                        <span style={{
                                            padding: '8px 18px',
                                            borderRadius: '100px',
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            color: booking.status === 'ACCEPTED' ? '#10b981' : booking.status === 'CANCELLED' ? '#ef4444' : 'var(--accent)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--secondary)' }}>
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
