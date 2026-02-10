import https from 'https';
import crypto from 'crypto';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

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

    const base64Url = (str: string) => Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const toSign = `${base64Url(header)}.${base64Url(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(toSign);
    const signature = signer.sign(GOOGLE_KEY, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${toSign}.${signature}`;

    return new Promise<string>((resolve, reject) => {
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
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) resolve(parsed.access_token);
                    else reject(new Error(parsed.error_description || "Auth Failed"));
                } catch (e) {
                    reject(new Error("Token Parse Error"));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

export async function getLeads() {
    try {
        if (!GOOGLE_SHEET_ID) throw new Error("Google Sheet ID Missing");
        const token = await getGoogleAccessToken();

        // 1. Get spreadsheet metadata to find all sheets
        const metadata: any = await new Promise((resolve, reject) => {
            https.request({
                hostname: 'sheets.googleapis.com',
                path: `/v4/spreadsheets/${GOOGLE_SHEET_ID}`,
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

        if (!metadata.sheets) return [];
        const sheetNames = metadata.sheets.map((s: any) => s.properties.title);

        // 2. Fetch data from each sheet
        const allLeads = await Promise.all(sheetNames.map(async (sheetName: string) => {
            const rows: any[][] = await new Promise((resolve, reject) => {
                https.request({
                    hostname: 'sheets.googleapis.com',
                    path: `/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(`'${sheetName}'!A2:E`)}`,
                    headers: { 'Authorization': `Bearer ${token}` }
                }, (res) => {
                    let d = ''; res.on('data', chunk => d += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(d);
                            resolve(parsed.values || []);
                        } catch (e) { resolve([]); }
                    });
                }).on('error', () => resolve([])).end();
            });

            return rows.filter(r => r[0] || r[1]).map(r => ({
                source: sheetName,
                email: (r[0] || '').trim().toLowerCase(),
                phone: (r[1] || '').replace(/\D/g, ''),
                name: r[2] || 'Lead',
                timestamp: r[3] || '',
                addons: r[4] || ''
            }));
        }));

        return allLeads.flat();
    } catch (error) {
        console.error("Error fetching leads:", error);
        return [];
    }
}
