import { square } from '@/lib/square';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
    let customers: any[] = [];
    let error: string | null = null;

    try {
        const response = await square.customersApi.listCustomers();
        // Manual serialization to handle BigInt
        customers = JSON.parse(JSON.stringify(response.result.customers || [], (k, v) =>
            typeof v === 'bigint' ? v.toString() : v
        ));
    } catch (e: any) {
        console.error("Error fetching customers:", e);
        error = e.message || "Failed to load customers";
    }

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '6rem' }}>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-4px', textTransform: 'uppercase' }}>Customers</h1>
            </div>

            <div className="table-wrap">
                {error ? (
                    <div style={{ padding: '5rem', textAlign: 'center', color: '#ef4444' }}>
                        <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>Error: {error}</p>
                    </div>
                ) : customers.length === 0 ? (
                    <div style={{ padding: '5rem', textAlign: 'center', opacity: 0.5 }}>
                        <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>No customers found in this environment</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((customer: any) => (
                                <tr key={customer.id}>
                                    <td style={{ fontWeight: 800 }}>
                                        {customer.givenName} {customer.familyName}
                                    </td>
                                    <td style={{ color: 'var(--secondary)' }}>{customer.emailAddress || '-'}</td>
                                    <td style={{ color: 'var(--secondary)' }}>{customer.phoneNumber || '-'}</td>
                                    <td style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                                        {new Date(customer.createdAt).toLocaleDateString()}
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
