const express = require('express');
const app = express();

app.use(express.json());

let activeKeys = {};

function getDurationMs(validity) {
    if (!validity) return 24 * 60 * 60 * 1000;
    const val = validity.toLowerCase().trim();
    if (val === '1y' || val === '365d') return 365 * 24 * 60 * 60 * 1000;
    if (val.endsWith('d')) {
        const days = parseInt(val);
        if (!isNaN(days)) return days * 24 * 60 * 60 * 1000;
    }
    return 24 * 60 * 60 * 1000;
}

// --- API CORE HANDLERS ---
const handleGenerate = (req, res) => {
    const validity = req.query.validity || '1d';
    const maxDevices = parseInt(req.query.devices) || 1;
    const durationMs = getDurationMs(validity);
    const expiresAt = Date.now() + durationMs;

    const randomKey = 'BOSS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    activeKeys[randomKey] = {
        createdAt: Date.now(),
        expiresAt: expiresAt,
        maxDevices: maxDevices,
        usedDevices: []
    };

    res.status(200).json({
        status: 'success',
        message: 'BOSS Key generated successfully!',
        key: randomKey,
        maxDevices: maxDevices,
        expiresAt: new Date(expiresAt).toLocaleString()
    });
};

const handleValidate = (req, res) => {
    const userKey = req.query.key;
    const deviceId = req.query.device || 'default-device';

    if (!userKey) {
        return res.status(400).json({ status: 'error', message: 'API key is missing!' });
    }

    const keyData = activeKeys[userKey];

    if (!keyData) {
        return res.status(401).json({ status: 'error', message: 'Invalid BOSS Key!' });
    }

    if (Date.now() > keyData.expiresAt) {
        delete activeKeys[userKey];
        return res.status(403).json({ status: 'error', message: 'BOSS Key has EXPIRED!' });
    }

    if (!keyData.usedDevices.includes(deviceId)) {
        if (keyData.usedDevices.length >= keyData.maxDevices) {
            return res.status(403).json({ 
                status: 'error', 
                message: `Device limit reached! Max allowed: ${keyData.maxDevices}` 
            });
        }
        keyData.usedDevices.push(deviceId);
    }

    res.status(200).json({
        status: 'success',
        message: 'Valid BOSS Key!',
        key: userKey,
        devicesUsed: keyData.usedDevices.length,
        maxDevices: keyData.maxDevices,
        expiresAt: new Date(keyData.expiresAt).toLocaleString()
    });
};

const handleDelete = (req, res) => {
    const userKey = req.query.key;

    if (activeKeys[userKey]) {
        delete activeKeys[userKey];
        return res.status(200).json({ status: 'success', message: `BOSS Key ${userKey} deleted successfully!` });
    } else {
        return res.status(404).json({ status: 'error', message: 'BOSS Key not found!' });
    }
};

const handleList = (req, res) => {
    const now = Date.now();
    for (let k in activeKeys) {
        if (now > activeKeys[k].expiresAt) delete activeKeys[k];
    }
    res.status(200).json({ status: 'success', keys: activeKeys });
};

// --- ROUTES (Supporting both standard and /api prefixed paths) ---
app.get('/generate', handleGenerate);
app.get('/api/generate', handleGenerate);

app.get('/validate', handleValidate);
app.get('/api/validate', handleValidate);

app.get('/delete', handleDelete);
app.get('/api/delete', handleDelete);

app.get('/keys', handleList);
app.get('/api/keys', handleList);

app.get('/api', (req, res) => {
    res.status(200).json({
        status: 'online',
        service: 'BOSS Key API System',
        endpoints: {
            generate: '/api/generate?validity=1d&devices=1',
            validate: '/api/validate?key=YOUR_KEY&device=DEVICE_ID',
            delete: '/api/delete?key=YOUR_KEY',
            keys: '/api/keys'
        }
    });
});

// --- ADMIN UI DASHBOARD ---
app.get('/', (req, res) => {
    let daysOptions = '';
    for (let i = 1; i <= 29; i++) {
        daysOptions += `<option value="${i}d">${i} Day${i > 1 ? 's' : ''}</option>`;
    }

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BOSS Key Manager Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        body {
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            color: #ffffff; min-height: 100vh; padding: 20px;
            display: flex; flex-direction: column; align-items: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1); padding: 25px;
            border-radius: 15px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            max-width: 600px; width: 100%; margin-bottom: 20px;
        }
        h1 {
            font-size: 22px; text-align: center; margin-bottom: 5px;
            background: linear-gradient(45deg, #ff007f, #7928ca, #00dfd8);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        p.sub { text-align: center; color: #b0b0b0; font-size: 12px; margin-bottom: 20px; }
        .controls { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        select, input, button {
            padding: 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.4); color: #fff; outline: none; font-size: 13px;
        }
        select option { background: #1a1a2e; color: #fff; }
        button {
            background: linear-gradient(45deg, #7928ca, #ff007f); color: white;
            font-weight: bold; cursor: pointer; border: none; flex: 1; min-width: 120px;
        }
        button:hover { opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        th { color: #00dfd8; }
        .del-btn { background: linear-gradient(45deg, #ff4d4d, #b30000); padding: 5px 10px; font-size: 11px; flex: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>BOSS Key Manager Panel</h1>
        <p class="sub">Generate, Manage & Delete Keys Instantly</p>
        
        <div class="controls">
            <select id="valSelect" style="flex: 2;">
                ${daysOptions}
                <option value="1y">1 Year (365 Days)</option>
            </select>
            <input type="number" id="devSelect" value="1" min="1" max="50" style="flex: 1;" placeholder="Devices">
            <button onclick="generateKey()">Generate Key</button>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Devices</th>
                    <th>Expires At</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="keyList">
                <tr><td colspan="4" style="text-align:center; color:#b0b0b0;">Loading keys...</td></tr>
            </tbody>
        </table>
    </div>

    <script>
        async function fetchKeys() {
            try {
                const res = await fetch('/keys');
                const data = await res.json();
                const tbody = document.getElementById('keyList');
                tbody.innerHTML = '';
                
                const keys = data.keys;
                if (!keys || Object.keys(keys).length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#b0b0b0;">No active keys found!</td></tr>';
                    return;
                }

                for (let k in keys) {
                    let item = keys[k];
                    let dateStr = new Date(item.expiresAt).toLocaleString();
                    tbody.innerHTML += \`
                        <tr>
                            <td><code style="color:#00dfd8; font-weight:bold;">\${k}</code></td>
                            <td>\${item.usedDevices.length}/\${item.maxDevices}</td>
                            <td>\${dateStr}</td>
                            <td><button class="del-btn" onclick="deleteKey('\${k}')">Delete</button></td>
                        </tr>
                    \`;
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function generateKey() {
            const val = document.getElementById('valSelect').value;
            const dev = document.getElementById('devSelect').value;
            await fetch(\`/generate?validity=\${val}&devices=\${dev}\`);
            fetchKeys();
        }

        async function deleteKey(key) {
            await fetch(\`/delete?key=\${encodeURIComponent(key)}\`);
            fetchKeys();
        }

        fetchKeys();
        setInterval(fetchKeys, 5000);
    </script>
</body>
</html>
    `);
});

module.exports = app;
