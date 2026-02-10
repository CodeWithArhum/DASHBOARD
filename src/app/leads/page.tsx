import { getLeads } from '@/lib/sheets';
import { getBookings } from '@/lib/actions';
import { square } from '@/lib/square';

export const dynamic = 'force-dynamic';

export default async function LeadsHubPage() {
    const [leads, bookings, customersRes] = await Promise.all([
        getLeads(),
        getBookings(),
        square.customersApi.listCustomers({ limit: 100 }).catch(() => ({ result: { customers: [] } }))
    ]);

    const customers = customersRes.result.customers || [];

    // Match leads with customers and bookings
    const enrichedLeads = leads.map(lead => {
        const matchedCustomer = customers.find((c: any) => {
            const sqEmail = (c.emailAddress || '').trim().toLowerCase();
            const sqPhone = (c.phoneNumber || '').replace(/\D/g, '');
            return (lead.email && sqEmail === lead.email) || (lead.phone && sqPhone === lead.phone && lead.phone.length > 5);
        });

        const hasBooking = matchedCustomer && bookings.some((b: any) => b.customerId === matchedCustomer.id);

        return {
            ...lead,
            status: hasBooking ? 'BOOKED' : matchedCustomer ? 'MATCHED' : 'NEW',
            customerId: matchedCustomer?.id
        };
    });

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '6rem' }}>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-4px', textTransform: 'uppercase' }}>Leads Hub</h1>
            </div>

            <div className="table-wrap">
                {enrichedLeads.length === 0 ? (
                    <div style={{ padding: '5rem', textAlign: 'center', opacity: 0.5 }}>
                        <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>No leads discovered yet</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Source</th>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {enrichedLeads.map((lead, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{lead.source.toUpperCase()}</td>
                                    <td style={{ fontWeight: 700 }}>{lead.name}</td>
                                    <td>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>{lead.email}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{lead.phone}</div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '8px 18px',
                                            borderRadius: '100px',
                                            background: lead.status === 'BOOKED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            fontSize: '0.75rem',
                                            fontWeight: 900,
                                            color: lead.status === 'BOOKED' ? '#10b981' : lead.status === 'MATCHED' ? '#6366f1' : '#fff',
                                            textTransform: 'uppercase',
                                            border: lead.status === 'BOOKED' ? '1px solid rgba(16, 185, 129, 0.3)' : 'none'
                                        }}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>
                                        {lead.addons || lead.timestamp || '-'}
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
