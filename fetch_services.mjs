import https from 'https';

const ACCESS_TOKEN = 'EAAAlwwZc986SOnGptz-rLM3GQe5DXnMFUs5hoSLMKI54TzaiM5x6DhlqR6GBNsn';

function squareRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'connect.squareup.com',
            path: '/v2/' + endpoint,
            method: 'GET',
            headers: {
                'Square-Version': '2024-01-18',
                'Authorization': 'Bearer ' + ACCESS_TOKEN,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) reject(new Error(parsed.errors ? parsed.errors[0].detail : 'API Error'));
                    else resolve(parsed);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function listCatalog() {
    try {
        console.log('Fetching full catalog...');
        const response = await squareRequest('catalog/list');
        if (!response.objects) {
            console.log('No objects found in catalog.');
            return;
        }

        console.log('--- CATALOG OBJECTS ---');
        response.objects.forEach(obj => {
            console.log(`Type: ${obj.type} | ID: ${obj.id}`);
            if (obj.item_data) console.log(`  Name: ${obj.item_data.name}`);
            if (obj.appointments_service_data) console.log(`  Service Name: ${obj.appointments_service_data.name}`);
        });
        console.log('--- END ---');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

listCatalog();
