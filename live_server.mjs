import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';

// SIMPLE ENV LOADER (No Dependences)
if (fs.existsSync('.env.local')) {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) {
            let value = val.join('=').trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            process.env[key.trim()] = value;
        }
    });
}

const PORT = 3000;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || 'EAAAlwwZc986SOnGptz-rLM3GQe5DXnMFUs5hoSLMKI54TzaiM5x6DhlqR6GBNsn';

// GOOGLE CONFIG
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

// SYSTEM STATE (Bulletproof Persistence)
let CATALOG_MAP = { "Recovery": "Standard Service" };
let CATALOG_LIST = [];
let LOCATION_ID = null;

// FALLBACK SERVICE LIST
const SQUARE_SERVICES = [
    "Combined Recovery",
    "VR Meditation Immersion",
    "Focused Recovery",
    "Full / Multi-Area Recovery",
    "AI Couples Recovery Experience"
];

/**
 * HIGH-FIDELITY SQUARE REQUEST WRAPPER
 */
function squareRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'connect.squareup.com',
            path: '/v2/' + endpoint,
            method: method,
            headers: {
                'Square-Version': '2024-01-18',
                'Authorization': 'Bearer ' + ACCESS_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (data.trim() === '') {
                        if (res.statusCode >= 400) reject(new Error(`API Error ${res.statusCode}`));
                        else resolve({});
                        return;
                    }
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        const msg = parsed.errors ? parsed.errors[0].detail : `API Error ${res.statusCode}`;
                        reject(new Error(msg));
                    } else resolve(parsed);
                } catch (e) { reject(new Error("Response Error")); }
            });
        });

        req.on('error', (e) => reject(new Error(`Network Error: ${e.message}`)));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/**
 * GOOGLE AUTH (Service Account JWT)
 */
async function getGoogleAccessToken() {
    if (!GOOGLE_EMAIL || !GOOGLE_KEY) throw new Error("Google Credentials Missing");

    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = JSON.stringify({
        iss: GOOGLE_EMAIL,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp, iat
    });

    const base64Url = (str) => Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const toSign = `${base64Url(header)}.${base64Url(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(toSign);
    const signature = signer.sign(GOOGLE_KEY, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${toSign}.${signature}`;

    return new Promise((resolve, reject) => {
        const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const parsed = JSON.parse(data);
                if (parsed.access_token) resolve(parsed.access_token);
                else reject(new Error(parsed.error_description || "Auth Failed"));
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * GOOGLE SHEETS WRAPPER
 */
async function sheetsRequest(spreadsheetId, range) {
    const token = await getGoogleAccessToken();
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'sheets.googleapis.com',
            path: `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        console.error(`Sheets API Error [${range}]:`, parsed.error?.message);
                        reject(new Error(parsed.error?.message || "Sheets API Error"));
                    } else {
                        console.log(`Sheets Data [${range}]:`, parsed.values ? parsed.values.length : 0, 'rows');
                        resolve(parsed.values || []);
                    }
                } catch (e) { reject(new Error("JSON Parse Error")); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * AUTO-DISCOVERY SYSTEM
 */
async function initSystem() {
    try {
        const [locs, cat] = await Promise.all([
            squareRequest('locations').catch(() => ({ locations: [] })),
            squareRequest('catalog/list?types=ITEM').catch(() => ({ objects: [] }))
        ]);

        if (locs.locations && locs.locations.length > 0) {
            LOCATION_ID = locs.locations.find(l => l.status === 'ACTIVE')?.id || locs.locations[0].id;
        }

        if (cat.objects) {
            let tempMap = { "Recovery": { name: "Standard Service", price: 0 } };
            let tempList = [];
            cat.objects.forEach(item => {
                const itemName = item.item_data?.name || "Service";
                if (item.item_data?.variations) {
                    item.item_data.variations.forEach(v => {
                        const varName = v.item_variation_data?.name || "";
                        const displayName = (varName.toLowerCase() === "regular" || !varName) ? itemName : `${itemName} (${varName})`;
                        const price = v.item_variation_data?.price_money?.amount ? Number(v.item_variation_data.price_money.amount) / 100 : 0;
                        tempMap[v.id] = { name: displayName, price };
                        tempList.push({ id: v.id, name: displayName, price });
                    });
                }
            });
            CATALOG_MAP = tempMap;
            CATALOG_LIST = tempList.sort((a, b) => a.name.localeCompare(b.name));
        }
    } catch (e) { console.error('Init Error:', e.message); }
}
initSystem();

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/metrics') {
        try {
            const [bRes, cRes] = await Promise.all([
                squareRequest('bookings?limit=100').catch(() => ({ bookings: [] })),
                squareRequest('customers?limit=100').catch(() => ({ customers: [] }))
            ]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                bookings: bRes.bookings || [],
                activeCustomers: (cRes.customers || []).length,
                catalog: CATALOG_MAP,
                catalog_list: CATALOG_LIST
            }));
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/customers') {
        try {
            const data = await squareRequest('customers?limit=100').catch(() => ({ customers: [] }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data.customers || []));
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/bookings') {
        let bodyBuffer = '';
        req.on('data', chunk => bodyBuffer += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(bodyBuffer);
                const bookingData = {
                    booking: {
                        start_at: new Date(payload.start_at).toISOString(),
                        location_id: LOCATION_ID,
                        customer_id: payload.customer_id,
                        appointment_segments: [{ service_variation_id: payload.service_id }]
                    }
                };
                const result = await squareRequest('bookings', 'POST', bookingData);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/api/leads') {
        try {
            console.log('Syncing Leads Hub from Google Sheets...');
            const cleanID = GOOGLE_SHEET_ID ? GOOGLE_SHEET_ID.trim() : "";
            const token = await getGoogleAccessToken();

            // Fetch Square data for matching
            const [bRes, cRes] = await Promise.all([
                squareRequest('bookings?limit=100').catch(() => ({ bookings: [] })),
                squareRequest('customers?limit=100').catch(() => ({ customers: [] }))
            ]);
            const customersData = cRes.customers || [];
            const bookingsData = bRes.bookings || [];

            const meta = await new Promise((resolve, reject) => {
                https.request({
                    hostname: 'sheets.googleapis.com',
                    path: `/v4/spreadsheets/${cleanID}`,
                    headers: { 'Authorization': `Bearer ${token}` }
                }, (res) => {
                    let d = ''; res.on('data', chunk => d += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(d);
                            if (res.statusCode >= 400) reject(new Error(parsed.error?.message || "Metadata Error"));
                            else resolve(parsed);
                        } catch (e) { reject(new Error("JSON Parse Error on Metadata")); }
                    });
                }).on('error', reject).end();
            });

            if (!meta.sheets) throw new Error(meta.error?.message || "Invalid Spreadsheet ID");
            const sheetNames = meta.sheets.map(s => s.properties.title);
            console.log('Found Sheets:', sheetNames.join(', '));

            const allLeads = await Promise.all(sheetNames.map(async (s) => {
                const rows = await sheetsRequest(GOOGLE_SHEET_ID, `'${s}'!A2:E`).catch((err) => {
                    console.error(`Error reading sheet [${s}]:`, err.message);
                    return [];
                });
                return rows.map(r => {
                    const email = (r[0] || '').trim().toLowerCase();
                    const phone = (r[1] || '').replace(/\D/g, '');

                    // Match against Square Customers
                    const matchedCustomer = customersData.find(c => {
                        const sqEmail = (c.email_address || '').trim().toLowerCase();
                        const sqPhone = (c.phone_number || '').replace(/\D/g, '');
                        return (email && sqEmail === email) || (phone && sqPhone === phone && phone.length > 5);
                    });

                    // Check if matched customer has any bookings
                    const hasBooking = matchedCustomer && bookingsData.some(b => b.customer_id === matchedCustomer.id);

                    return {
                        email: r[0] || '',
                        phone: r[1] || '',
                        type: r[2] || '',
                        addons: r[3] || '',
                        time: r[4] || '',
                        source: s,
                        status: hasBooking ? 'BOOKED' : 'NEW'
                    };
                }).filter(l => (l.email && l.email !== "N/A" && l.email.trim() !== "") || (l.phone && l.phone !== "N/A" && l.phone.trim() !== ""));
            }));

            const flatLeads = allLeads.flat();
            console.log(`Leads Hub Sync Complete. Total: ${flatLeads.length}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(flatLeads));
        } catch (e) {
            console.error('Leads Hub Sync Failed:', e.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // FRONTEND: DASHBOARD v7.0 (SIMPLIFIED ELITE MASTER)
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '    <meta charset="UTF-8">' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '    <title>Almatiq | Dashboard</title>' +
        '    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22 fill=%22%23ffffff%22 font-family=%22Outfit%22 font-weight=%22300%22>Λ</text></svg>">' +
        '    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
        '    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>' +
        '    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>' +
        '    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>' +
        '    <script src="https://unpkg.com/lucide@latest"></script>' +
        '    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' +
        '    <style>' +
        '        :root {' +
        '            --background: #000000; --foreground: #ffffff;' +
        '            --card-bg: rgba(255, 255, 255, 0.03); --card-border: rgba(255, 255, 255, 0.07);' +
        '            --accent: #6366f1; --accent-glow: rgba(99, 102, 241, 0.35);' +
        '            --secondary: #64748b; --font-main: \'Outfit\', sans-serif;' +
        '            --radius-xl: 45px; --radius-lg: 24px; --radius-md: 16px;' +
        '            --glass-grad: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);' +
        '        }' +
        '        * { box-sizing: border-box; padding: 0; margin: 0; -webkit-font-smoothing: antialiased; }' +
        '        body { color: var(--foreground); background: var(--background); font-family: var(--font-main); min-height: 100vh; display: flex; overflow-x: hidden; width: 100vw; }' +
        '' +
        '        /* Elite Sidebar (Bespoke Glassmorphism) */' +
        '        aside { width: 320px; height: 100vh; position: fixed; left: 0; top: 0; border-right: 1px solid var(--card-border); background: rgba(5, 5, 5, 0.5); backdrop-filter: blur(100px); padding: 5rem 3rem; display: flex; flex-direction: column; z-index: 10000; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }' +
        '        .logo { font-size: 1.8rem; font-weight: 800; margin-bottom: 7rem; display: flex; align-items: center; gap: 18px; color: #fff; letter-spacing: -1.5px; text-transform: uppercase; }' +
        '        .nav-item { display: flex; align-items: center; gap: 1.4rem; padding: 1.4rem 2rem; border-radius: var(--radius-md); color: var(--secondary); text-decoration: none; transition: 0.5s cubic-bezier(0.16, 1, 0.3, 1); margin-bottom: 1rem; cursor: pointer; font-weight: 600; font-size: 1rem; letter-spacing: 0.5px; }' +
        '        .nav-item:hover { color: #fff; background: rgba(255, 255, 255, 0.04); transform: translateX(8px); }' +
        '        .nav-item.active { color: #fff; background: var(--accent); box-shadow: 0 25px 50px -12px var(--accent-glow); }' +
        '' +
        '        /* Mobile Trigger */' +
        '        .mobile-header { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 80px; background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); z-index: 9999; padding: 0 2rem; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--card-border); }' +
        '        .menu-btn { background: transparent; border: none; color: #fff; cursor: pointer; }' +
        '' +
        '        /* Canvas */' +
        '        main { margin-left: 320px; flex: 1; padding: 6rem 4rem 6rem 8rem; min-height: 100vh; display: flex; flex-direction: column; animation: reveal 1s cubic-bezier(0.16, 1, 0.3, 1); min-width: 0; position: relative; }' +
        '        .page-header { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-bottom: 6rem; gap: 3rem; flex-wrap: wrap; }' +
        '        .page-header h1 { font-size: 4.5rem; font-weight: 800; letter-spacing: -4px; line-height: 0.85; text-transform: uppercase; }' +
        '' +
        '        /* Glass Components */' +
        '        .glass-card { background: var(--glass-grad); backdrop-filter: blur(50px); border: 1px solid var(--card-border); border-radius: var(--radius-xl); transition: 0.6s cubic-bezier(0.16, 1, 0.3, 1); width: 100%; position: relative; overflow: hidden; }' +
        '        .glass-card::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent); pointer-events: none; }' +
        '        .glass-card:hover { border-color: rgba(255, 255, 255, 0.2); transform: translateY(-10px) scale(1.01); background: rgba(255, 255, 255, 0.06); box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); }' +
        '' +
        '        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2.5rem; width: 100%; margin-bottom: 2.5rem; }' +
        '        .metric-content { padding: 4.5rem 4rem; }' +
        '        .metric-content p { color: var(--secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 1.5rem; opacity: 0.6; }' +
        '        .metric-content h2 { font-size: 4.2rem; font-weight: 800; color: #fff; letter-spacing: -2px; line-height: 1; }' +
        '' +
        '        .chart-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2.5rem; width: 100%; margin-bottom: 2.5rem; }' +
        '        .chart-card { padding: 4rem; }' +
        '        .chart-card h3 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 3.5rem; }' +
        '' +
        '        /* Standard Table */' +
        '        .table-wrap { overflow-x: auto; background: var(--background); border-radius: var(--radius-xl); border: 1px solid var(--card-border); width: 100%; display: block; -webkit-overflow-scrolling: touch; }' +
        '        table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1200px; }' +
        '        th { padding: 2.8rem 2.2rem; text-align: left; color: var(--secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid var(--card-border); white-space: nowrap; }' +
        '        td { padding: 2.8rem 2.2rem; border-bottom: 1px solid var(--card-border); font-size: 1.1rem; transition: 0.4s; white-space: nowrap; font-weight: 500; }' +
        '        tr:hover td { background: rgba(255, 255, 255, 0.02); color: #fff; }' +
        '' +
        '        /* Simplified CRM List */' +
        '        .customer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2.5rem; width: 100%; }' +
        '        .customer-card { padding: 5rem 4rem; text-align: center; }' +
        '        .avatar { width: 120px; height: 120px; background: var(--accent); color: #fff; border-radius: 40px; margin: 0 auto 3rem; display: flex; align-items: center; justify-content: center; font-size: 3.2rem; font-weight: 800; box-shadow: 0 30px 60px -10px var(--accent-glow); transform: rotate(-5deg); transition: 0.6s cubic-bezier(0.16, 1, 0.3, 1); }' +
        '        .customer-card:hover .avatar { transform: rotate(0deg) scale(1.1); }' +
        '' +
        '        /* Calendar */' +
        '        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 15px; }' +
        '        .cal-day { height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 22px; cursor: pointer; transition: 0.4s; position: relative; font-weight: 700; font-size: 1.2rem; border: 1px solid transparent; }' +
        '        .cal-day:hover:not(.muted) { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); transform: scale(1.05); }' +
        '        .cal-day.selected { background: var(--accent); color: #fff; font-weight: 800; box-shadow: 0 20px 40px -8px var(--accent-glow); z-index: 2; border-color: transparent; }' +
        '        .cal-day.in-range { background: rgba(99, 102, 241, 0.15); }' +
        '        .cal-day.today::after { content: \'\'; position: absolute; bottom: 12px; width: 10px; height: 10px; border-radius: 50%; background: var(--foreground); box-shadow: 0 0 15px var(--foreground); }' +
        '        .cal-day.muted { opacity: 0.05; cursor: default; }' +
        '' +
        '        /* Simple Buttons */' +
        '        .btn { border: none; font-weight: 800; cursor: pointer; transition: 0.6s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; gap: 14px; font-family: inherit; letter-spacing: 1px; text-transform: uppercase; }' +
        '        .btn-primary { background: var(--accent); color: white; padding: 1.5rem 3.5rem; border-radius: var(--radius-md); font-size: 0.9rem; box-shadow: 0 15px 35px -10px var(--accent-glow); }' +
        '        .btn-primary:hover { transform: translateY(-5px); box-shadow: 0 30px 60px -15px var(--accent-glow); }' +
        '        .btn-outline { background: transparent; border: 1px solid var(--card-border); color: #fff; padding: 1.2rem 2.5rem; border-radius: 18px; font-size: 0.8rem; }' +
        '        .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: #fff; }' +
        '' +
        '        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.96); backdrop-filter: blur(60px); display: flex; align-items: center; justify-content: center; z-index: 999999; animation: fadeIn 0.5s; }' +
        '        .modal-content { background: #080808; border: 1px solid var(--card-border); border-radius: 60px; width: 95%; max-width: 750px; padding: 6rem; position: relative; animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1); }' +
        '' +
        '        .form-group { margin-bottom: 2.8rem; }' +
        '        .form-group label { display: block; color: var(--secondary); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2.5px; margin-bottom: 1.2rem; opacity: 0.7; }' +
        '        .form-input { width: 100%; background: #0f0f0f; border: 1px solid var(--card-border); color: #fff; padding: 1.6rem; border-radius: 20px; outline: none; font-size: 1.1rem; font-family: inherit; transition: 0.4s; color-scheme: dark; }' +
        '        .form-input:focus { border-color: var(--accent); background: #151515; }' +
        '        select.form-input { appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 1.8rem center; background-size: 1.25em; }' +
        '        option { background: #0a0a0a; color: #fff; }' +
        '' +
        '        @media (max-width: 1300px) { main { margin-left: 280px; padding: 4rem 2rem 4rem 3.5rem; } aside { width: 280px; } }' +
        '        @media (max-width: 1080px) { aside { transform: translateX(-100%); } aside.active { transform: translateX(0); } .mobile-header { display: flex; } main { margin-left: 0; padding-top: 120px; } .page-header h1 { font-size: 3rem; } }' +
        '        @media (max-width: 600px) { .metrics-grid { grid-template-columns: 1fr; } .page-header h1 { font-size: 2.4rem; } .modal-content { padding: 3rem 2rem; } }' +
        '' +
        '        @keyframes reveal { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }' +
        '        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }' +
        '        @keyframes slideUp { from { opacity: 0; transform: translateY(80px); } to { opacity: 1; transform: translateY(0); } }' +
        '        .loader { width: 30px; height: 30px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }' +
        '        @keyframes spin { to { transform: rotate(360deg); } }' +
        '    </style>' +
        '</head>' +
        '<body>' +
        '    <div id="root" style="display: flex; width: 100%;"></div>' +
        '    <script type="text/babel">' +
        '        const { useState, useEffect, useRef, useMemo, useCallback } = React;' +
        '        const FALLBACK_SERVICES = ' + JSON.stringify(SQUARE_SERVICES) + ';' +
        '' +
        '        const BookingChart = React.memo(({ trends }) => {' +
        '            const canvasRef = useRef(null); const chartRef = useRef(null);' +
        '            useEffect(() => {' +
        '                if (canvasRef.current) {' +
        '                    if (chartRef.current) chartRef.current.destroy();' +
        '                    const ctx = canvasRef.current.getContext(\'2d\');' +
        '                    chartRef.current = new Chart(ctx, { type: \'line\', data: { labels: trends.labels, datasets: [{ data: trends.values, borderColor: \'#6366f1\', backgroundColor: \'rgba(99, 102, 241, 0.08)\', fill: true, tension: 0.45, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: \'#fff\', pointBorderColor: \'#6366f1\', pointBorderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: \'#64748b\', font: { family: \'Outfit\', weight: 600 } } }, y: { grid: { color: \'rgba(255,255,255,0.03)\' }, ticks: { color: \'#64748b\', font: { family: \'Outfit\', weight: 600 } } } } } });' +
        '                }' +
        '            }, [trends]);' +
        '            return <canvas ref={canvasRef} />;' +
        '        });' +
        '' +
        '        const DistributionChart = React.memo(({ data, labels }) => {' +
        '            const canvasRef = useRef(null); const chartRef = useRef(null);' +
        '            useEffect(() => {' +
        '                if (canvasRef.current) {' +
        '                    if (chartRef.current) chartRef.current.destroy();' +
        '                    const ctx = canvasRef.current.getContext(\'2d\');' +
        '                    chartRef.current = new Chart(ctx, { type: \'doughnut\', data: { labels: labels, datasets: [{ data: data, backgroundColor: [\'#6366f1\', \'#818cf8\', \'#a5b4fc\', \'#c7d2fe\', \'#e0e7ff\'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: \'82%\' } });' +
        '                }' +
        '            }, [data]);' +
        '            return <canvas ref={canvasRef} />;' +
        '        });' +
        '' +
        '        const AlmatiqLogo = ({ size = \"base\" }) => {' +
        '            const isSmall = size === \"small\";' +
        '            return (' +
        '                <div style={{ display: \'flex\', flexDirection: \'column\', alignItems: \'center\', gap: isSmall ? \'2px\' : \'6px\', textAlign: \'center\', userSelect: \'none\', padding: isSmall ? \'0\' : \'1rem 0\' }}>' +
        '                    <div style={{ ' +
        '                        fontSize: isSmall ? \'1.2rem\' : \'2.6rem\', ' +
        '                        fontWeight: 300, ' +
        '                        letterSpacing: isSmall ? \'4px\' : \'12px\', ' +
        '                        color: \'#fff\', ' +
        '                        textShadow: \'0 0 25px rgba(255,255,255,0.4)\',' +
        '                        fontFamily: \'Outfit, sans-serif\',' +
        '                        display: \'flex\',' +
        '                        alignItems: \'center\',' +
        '                        justifyContent: \'center\',' +
        '                        lineHeight: 1' +
        '                    }}>' +
        '                        <span style={{ fontWeight: 400, marginRight: isSmall ? \'-2px\' : \'-6px\' }}>Λ</span>LMATIQ' +
        '                    </div>' +
        '                    <div style={{ ' +
        '                        fontSize: isSmall ? \'0.28rem\' : \'0.6rem\', ' +
        '                        fontWeight: 700, ' +
        '                        letterSpacing: isSmall ? \'1.5px\' : \'4px\', ' +
        '                        color: \'rgba(255,255,255,0.3)\',' +
        '                        textTransform: \'uppercase\',' +
        '                        whiteSpace: \'nowrap\',' +
        '                        marginTop: isSmall ? \'2px\' : \'4px\'' +
        '                    }}>' +
        '                        Where Science Touches Soul' +
        '                    </div>' +
        '                </div>' +
        '            );' +
        '        };' +
        '' +
        '        const Calendar = ({ range, setRange }) => {' +
        '            const [now, setNow] = useState(new Date());' +
        '            const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();' +
        '            const startDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();' +
        '            const days = [];' +
        '            for (let i = 0; i < startDay; i++) days.push({ val: \'\', muted: true });' +
        '            for (let i = 1; i <= daysInMonth(now.getFullYear(), now.getMonth()); i++) {' +
        '                const d = new Date(now.getFullYear(), now.getMonth(), i);' +
        '                const isStart = range.start && d.toDateString() === range.start.toDateString();' +
        '                const isEnd = range.end && d.toDateString() === range.end.toDateString();' +
        '                days.push({ val: i, date: d, today: d.toDateString() === new Date().toDateString(), selected: isStart || isEnd, inRange: range.start && range.end && d > range.start && d < range.end });' +
        '            }' +
        '            return (<div className="glass-card chart-card"><div style={{display:\'flex\', justifyContent:\'space-between\', alignItems: \'center\', marginBottom:\'3rem\'}}><h3 style={{fontSize:\'1.8rem\', fontWeight: 800}}>{now.toLocaleString(\'default\', { month: \'long\', year: \'numeric\' })}</h3><div style={{display:\'flex\', gap:\'10px\'}}><button onClick={() => setNow(new Date(now.getFullYear(), now.getMonth()-1, 1))} className="btn-outline" style={{padding:\'0.8rem\'}}><i data-lucide="chevron-left"></i></button><button onClick={() => setNow(new Date(now.getFullYear(), now.getMonth()+1, 1))} className="btn-outline" style={{padding:\'0.8rem\'}}><i data-lucide="chevron-right"></i></button></div></div><div className="cal-grid">{[\'Sun\', \'Mon\', \'Tue\', \'Wed\', \'Thu\', \'Fri\', \'Sat\'].map(d => <div key={d} style={{fontSize:\'0.8rem\', fontWeight:800, color:\'var(--secondary)\', textAlign:\'center\', marginBottom:\'1.5rem\'}}>{d}</div>)}{days.map((d, i) => (<div key={i} className={"cal-day " + (d.muted ? "muted " : "") + (d.today ? "today " : "") + (d.selected ? "selected " : "") + (d.inRange ? "in-range" : "")} onClick={() => !d.muted && setRange(r => (!r.start || (r.start && r.end)) ? {start: d.date, end: null} : (d.date < r.start ? {start: d.date, end: null} : {...r, end: d.date}))}>{d.val}</div>))}</div></div>);' +
        '        };' +
        '' +
        '        const App = () => {' +
        '            const [tab, setTab] = useState(\'overview\');' +
        '            const [data, setData] = useState({ bookings: [], activeCustomers: 0, catalog: {}, catalog_list: [] });' +
        '            const [customers, setCustomers] = useState([]);' +
        '            const [leads, setLeads] = useState([]);' +
        '            const [range, setRange] = useState({ start: null, end: null });' +
        '            const [modal, setModal] = useState({ type: null, data: null });' +
        '            const [loading, setLoading] = useState(true);' +
        '            const [formLoading, setFormLoading] = useState(false);' +
        '            const [sidebarActive, setSidebarActive] = useState(false);' +
        '' +
        '            const syncAll = useCallback(async () => {' +
        '                try {' +
        '                    const [m, c, l] = await Promise.all([' +
        '                        fetch(\'/api/metrics\').then(r => r.json()),' +
        '                        fetch(\'/api/customers\').then(r => r.json()),' +
        '                        fetch(\'/api/leads\').then(r => r.json())' +
        '                    ]);' +
        '                    setData(m); setCustomers(c); setLeads(l); setLoading(false);' +
        '                } catch (e) { console.error(\"Sync Error\", e); }' +
        '            }, []);' +
        '' +
        '            useEffect(() => { syncAll(); }, [syncAll]);' +
        '            useEffect(() => { if(window.lucide) lucide.createIcons(); }, [tab, loading, modal, sidebarActive]);' +
        '' +
        '            const stats = useMemo(() => {' +
        '                let filtered = data.bookings; if (range.start && range.end) filtered = data.bookings.filter(b => { const d = new Date(b.start_at); return d >= range.start && d <= new Date(range.end.getTime() + 86400000); });' +
        '                const trends = {}; const distro = {}; let revenueSum = 0;' +
        '                filtered.forEach(b => {' +
        '                    const d = new Date(b.start_at);' +
        '                    const dateKey = (range.start && range.end) ? d.toLocaleDateString(\'en-US\', {month:\'short\', day:\'numeric\'}) : d.toLocaleDateString(\'en-US\', {month:\'short\'});' +
        '                    trends[dateKey] = (trends[dateKey] || 0) + 1;' +
        '                    const catItem = data.catalog[b.appointment_segments?.[0]?.service_variation_id] || { name: \"Other\", price: 0 };' +
        '                    distro[catItem.name || \"Other\"] = (distro[catItem.name || \"Other\"] || 0) + 1;' +
        '                    revenueSum += (catItem.price || 0);' +
        '                });' +
        '                let lbls = []; if (range.start && range.end) {' +
        '                    let curr = new Date(range.start); while (curr <= range.end) { lbls.push(curr.toLocaleDateString(\'en-US\', {month:\'short\', day:\'numeric\'})); curr.setDate(curr.getDate() + 1); }' +
        '                } else {' +
        '                    const mNames = [\"Jan\", \"Feb\", \"Mar\", \"Apr\", \"May\", \"Jun\", \"Jul\", \"Aug\", \"Sep\", \"Oct\", \"Nov\", \"Dec\"]; const curr = new Date();' +
        '                    for(let i=7; i>=0; i--) { let d = new Date(curr.getFullYear(), curr.getMonth() - i, 1); lbls.push(mNames[d.getMonth()]); }' +
        '                }' +
        '                return { total: filtered.length, revenue: Math.round(revenueSum), avg: filtered.length ? Math.round(revenueSum / filtered.length) : 0, trends: { labels: lbls, values: lbls.map(l => trends[l] || 0) }, distro: { labels: Object.keys(distro).slice(0, 6), values: Object.values(distro).slice(0, 6) } };' +
        '            }, [data, range]);' +
        '' +
        '            const handleNewBooking = async (e) => {' +
        '                e.preventDefault(); setFormLoading(true);' +
        '                const fd = new FormData(e.target);' +
        '                const payload = { customer_id: fd.get(\'customer\'), service_id: fd.get(\'service\'), start_at: fd.get(\'time\') };' +
        '                try {' +
        '                    const res = await fetch(\'/api/bookings\', { method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body: JSON.stringify(payload) });' +
        '                    if (!res.ok) throw new Error(await res.text());' +
        '                    await syncAll(); setModal({type:null});' +
        '                } catch (err) { alert(\'Error: \' + err.message); } finally { setFormLoading(false); }' +
        '            };' +
        '' +
        '            if (loading) return <div style={{height:\'100vh\', width:\'100vw\', display:\'flex\', flexDirection:\'column\', alignItems:\'center\', justifyContent:\'center\', background:\'#000\', gap:\'30px\'}}><div className="loader"></div><h2 style={{letterSpacing:\'4px\', fontSize:\'1.1rem\', fontWeight:400, opacity:0.5}}>LOADING...</h2></div>;' +
        '' +
        '            return (<div style={{ display: \'flex\', width: \'100%\' }}><div className=\"mobile-header\"><div className=\"logo\" style={{margin:0}}><AlmatiqLogo size=\"small\" /></div><button className=\"menu-btn\" onClick={() => setSidebarActive(!sidebarActive)}><i data-lucide={sidebarActive ? \"x\" : \"menu\"}></i></button></div><aside className={sidebarActive ? \"active\" : \"\"}><div className=\"logo\" style={{marginBottom:\'8rem\', justifyContent:\'center\'}}><AlmatiqLogo /></div><nav><div className={\"nav-item \" + (tab === \'overview\' ? \'active\' : \'\')} onClick={() => { setTab(\'overview\'); setSidebarActive(false); }}><i data-lucide=\"layout-dashboard\"></i> Overview</div><div className={\"nav-item \" + (tab === \'leads\' ? \'active\' : \'\')} onClick={() => { setTab(\'leads\'); setSidebarActive(false); }}><i data-lucide=\"zap-off\" style={{color:\'#6366f1\'}}></i> Leads Hub</div><div className={\"nav-item \" + (tab === \'bookings\' ? \'active\' : \'\')} onClick={() => { setTab(\'bookings\'); setSidebarActive(false); }}><i data-lucide=\"book-marked\"></i> Bookings</div><div className={\"nav-item \" + (tab === \'customers\' ? \'active\' : \'\')} onClick={() => { setTab(\'customers\'); setSidebarActive(false); }}><i data-lucide=\"users\"></i> Customers</div></nav></aside>' +
        '            <main><div className=\"page-header\"><h1>{tab.toUpperCase()}</h1><div style={{display:\'flex\', gap:15, flexWrap:\'wrap\'}}>{range.start && <button className=\"btn btn-outline\" onClick={() => setRange({start:null,end:null})}>Reset Filters</button>}<button className=\"btn btn-primary\" onClick={() => setModal({type:\'booking\'})}><i data-lucide=\"plus\"></i> NEW BOOKING</button></div></div>' +
        '            {tab === \'overview\' && (<div style={{width:\'100%\'}}><div className=\"metrics-grid\"><div className=\"glass-card\"><div className=\"metric-content\"><p>Total Bookings</p><h2>{stats.total}</h2></div></div><div className=\"glass-card\"><div className=\"metric-content\"><p>Total Customers</p><h2>{data.activeCustomers}</h2></div></div><div className=\"glass-card\"><div className=\"metric-content\"><p>Average Price</p><h2>$ {stats.avg}</h2></div></div><div className=\"glass-card\"><div className=\"metric-content\"><p>Total Revenue</p><h2>$ {stats.revenue.toLocaleString()}</h2></div></div></div>' +
        '            <div className=\"chart-row\"><div className=\"glass-card chart-card\"><h3>Booking Trends</h3><div style={{height:\'350px\'}}><BookingChart trends={stats.trends} /></div></div><div className=\"glass-card chart-card\" style={{display:\'flex\', flexDirection:\'column\', alignItems:\'center\'}}><h3>Service Split</h3><div style={{height:\'220px\', width:\'220px\', position:\'relative\'}}><DistributionChart data={stats.distro.values} labels={stats.distro.labels} /><div style={{position:\'absolute\', top:\'55%\', left:\'50%\', transform:\'translate(-50%, -50%)\', textAlign:\'center\'}}><p style={{fontSize:\'0.7rem\', fontWeight:800, opacity:0.4}}>LIVE</p><p style={{fontSize:\'1.5rem\', fontWeight:800}}>DATA</p></div></div><div style={{width:\'100%\', marginTop:\'3.5rem\'}}>{stats.distro.labels.map((l, i) => (<div key={i} style={{display:\'flex\', justifyContent:\'space-between\', padding:\'1.1rem 0\', borderBottom:\'1px solid rgba(255,255,255,0.04)\', fontSize:\'0.9rem\'}}><span style={{color:\'var(--secondary)\', fontWeight:600}}>{l}</span><span style={{fontWeight:800}}>{stats.distro.values[i]}</span></div>))}</div></div></div><Calendar range={range} setRange={setRange} /></div>)}' +
        '            {tab === \'leads\' && (<div className=\"glass-card table-wrap\"><table><thead><tr><th>Source</th><th>Status</th><th>Email</th><th>Phone</th><th>Session Type</th><th>Add-ons</th><th>Time Collected</th></tr></thead><tbody>{leads.map((l, i) => (<tr key={i}><td><span style={{padding:\'6px 12px\', borderRadius:\'10px\', background:\'rgba(99,102,241,0.1)\', color:\'#818cf8\', fontSize:\'0.7rem\', fontWeight:800}}>{l.source.toUpperCase()}</span></td><td><span style={{padding:\'6px 14px\', borderRadius:\'100px\', background:l.status === \'BOOKED\' ? \'rgba(16,185,129,0.1)\' : \'rgba(99,102,241,0.1)\', color:l.status === \'BOOKED\' ? \'#10b981\' : \'#818cf8\', fontSize:\'0.65rem\', fontWeight:900, letterSpacing:\'1px\'}}>{l.status}</span></td><td style={{fontWeight:800}}>{l.email || \"N/A\"}</td><td>{l.phone || \"N/A\"}</td><td style={{color:\'var(--secondary)\', fontWeight:600}}>{l.type}</td><td>{l.addons || \"None\"}</td><td style={{fontSize:\'0.9rem\', opacity:0.6}}>{l.time}</td></tr>))}</tbody></table></div>)}' +
        '            {tab === \'bookings\' && (<div className=\"glass-card table-wrap\"><table><thead><tr><th>Customer Name</th><th>Date</th><th>Service</th><th>Status</th></tr></thead><tbody>{data.bookings.map(b => { const c = customers.find(x => x.id === b.customer_id); return (<tr key={b.id}><td style={{fontWeight:800}}>{c ? c.given_name + \" \" + c.family_name : \"Guest\"}</td><td>{new Date(b.start_at).toLocaleDateString()}</td><td style={{color:\'var(--secondary)\', fontWeight:600}}>{(data.catalog[b.appointment_segments?.[0]?.service_variation_id]?.name) || \"Booking\"}</td><td><span style={{padding:\'8px 18px\', borderRadius:\'100px\', background:\'rgba(255,255,255,0.06)\', fontSize:\'0.75rem\', fontWeight:900, color:\'var(--accent)\'}}>{b.status.toUpperCase()}</span></td></tr>); })}</tbody></table></div>)}' +
        '            {tab === \'customers\' && (<div className=\"customer-grid\">{customers.map(c => (<div key={c.id} className=\"glass-card customer-card\"><div className=\"avatar\">{(c.given_name || \"C\")[0]}</div><h3 style={{fontSize:\'1.5rem\', fontWeight:800, marginBottom:\'0.6rem\'}}>{c.given_name} {c.family_name}</h3><p style={{color:\'var(--secondary)\', fontSize:\'0.95rem\', marginBottom:\'3rem\'}}>{c.email_address || \"No Email\"}</p><button className=\"btn btn-outline\" style={{width:\'100%\', justifyContent:\'center\'}} onClick={() => setModal({type:\'profile\', data:c})}>View Profile</button></div>))}</div>)}</main>' +
        '            {modal.type && (<div className=\"modal-overlay\" onClick={() => !formLoading && setModal({type:null})}><div className=\"modal-content\" onClick={e => e.stopPropagation()}>{modal.type === \'booking\' ? (<form onSubmit={handleNewBooking}><h2 style={{fontSize:\'2.8rem\', fontWeight:800, marginBottom:\'3.5rem\', letterSpacing:\'-1.5px\'}}>New Booking</h2><div className=\"form-group\"><label>Select Customer</label><select name=\"customer\" className=\"form-input\" required>{customers.map(c => <option key={c.id} value={c.id}>{c.given_name} {c.family_name}</option>)}</select></div><div className=\"form-group\"><label>Select Service</label><select name=\"service\" className=\"form-input\" required>{data.catalog_list && data.catalog_list.length > 0 ? data.catalog_list.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : FALLBACK_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div className=\"form-group\"><label>Date & Time</label><input name=\"time\" type=\"datetime-local\" className=\"form-input\" required /></div><button type=\"submit\" className=\"btn btn-primary\" style={{width:\'100%\', padding:\'1.6rem\', justifyContent:\'center\', marginTop:\'2rem\'}} disabled={formLoading}>{formLoading ? <div className=\"loader\"></div> : \"Create Booking\"}</button></form>) : (<div><div style={{display:\'flex\', alignItems:\'center\', gap:\'2.5rem\', marginBottom:\'4rem\', flexWrap:\'wrap\'}}><div className=\"avatar\" style={{margin:0}}>{(modal.data.given_name || \"C\")[0]}</div><div><h2 style={{fontSize:\'2.5rem\', fontWeight:800, letterSpacing:\'-1px\'}}>{modal.data.given_name} {modal.data.family_name}</h2><p style={{color:\'var(--accent)\', fontWeight:800}}>Customer Profile</p></div></div><div style={{display:\'flex\', flexDirection:\'column\', gap:\'1.5rem\'}}><div className=\"glass-card\" style={{padding:\'1.8rem\', border:\'1px solid var(--card-border)\'}}><p style={{fontSize:\'0.75rem\', fontWeight:800, color:\'var(--secondary)\', marginBottom:\'8px\'}}>EMAIL</p><p style={{fontSize:\'1.2rem\', fontWeight:600}}>{modal.data.email_address || \"N/A\"}</p></div><div className=\"glass-card\" style={{padding:\'1.8rem\', border:\'1px solid var(--card-border)\'}}><p style={{fontSize:\'0.75rem\', fontWeight:800, color:\'var(--secondary)\', marginBottom:\'8px\'}}>PHONE</p><p style={{fontSize:\'1.2rem\', fontWeight:600}}>{modal.data.phone_number || \"N/A\"}</p></div><p style={{fontSize:\'0.7rem\', opacity:0.3, marginTop:\'1rem\'}}>ID: {modal.data.id}</p></div><button className=\"btn btn-primary\" style={{width:\'100%\', marginTop:\'4.5rem\', justifyContent:\'center\'}} onClick={() => setModal({type:null})}>Close</button></div>)}</div></div>)}</div>);' +
        '        };' +
        '        ReactDOM.createRoot(document.getElementById(\'root\')).render(<App />);' +
        '    </script>' +
        '</body>' +
        '</html>');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER v7.0 READY AT http://localhost:' + PORT);
});
