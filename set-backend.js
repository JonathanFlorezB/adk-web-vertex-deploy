/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const configPath = './src/assets/config/runtime-config.json';
const envPath = './.env';
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const args = process.argv.slice(2).reduce((acc, arg) => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        acc[key] = value;
    }
    return acc;
}, {});

const backendUrl = args.backend || process.env.npm_config_backend;
const signUrlApiUrl = args['sign-url-backend'] || process.env.npm_config_sign_url_backend || process.env.SIGN_URL_API_URL || 'http://localhost:3000';

if (!backendUrl) {
    console.error('Missing --backend argument');
    console.error('Usage: node set-backend.js --backend=http://127.0.0.1:8000 --sign-url-backend=http://localhost:3000');
    process.exit(1);
}

const config = {
    backendUrl,
    signUrlApiUrl
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`Backend URL injected: ${backendUrl}`);
console.log(`Sign URL API injected: ${signUrlApiUrl}`);
