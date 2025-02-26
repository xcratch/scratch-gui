import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import crossFetch from 'cross-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, '..');

const fetchTimeout = 30000; // [ms]

// Read preload rules
const rulesPath = path.join(__dirname, 'preload-rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// Check if URL should be ignored
const ignoreRegex = new RegExp(rules.ignore.join('|'));
const shouldIgnoreURL = url => ignoreRegex.test(url);

// Check if URL is allowed
const isAllowedURL = url => rules.allow.some(pattern => url === pattern);

// Create safe filename from URL
const getUrlAsPath = url => encodeURIComponent(url)
    .replace(/\./g, '%2E')
    .replace(/\//g, '%2F')
    .replace(/:/g, '%3A');

// Check if content is a valid Xcratch extension
const isValidExtensionContent = content => {
    try {
        // Check if content is empty
        if (!content.trim()) return false;
        
        // Check if content contains JavaScript code
        // Look for common Xcratch extension patterns
        return content.includes('blockClass') &&
            content.includes('entry') &&
            content.includes('getInfo');
    } catch (error) {
        return false;
    }
};

// Fetch with timeout
const fetchWithTimeout = async (url, timeout = fetchTimeout) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await crossFetch(url, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

const preloadDir = path.join(basePath, 'preload');

// Download extension to local
const downloadExtension = async ext => {
    console.info(`Downloading extension: ${ext.url}`);
    const extResponse = await fetchWithTimeout(ext.url);
    const content = await extResponse.text();
    // Validate content
    if (!isValidExtensionContent(content)) {
        throw new Error('Invalid extension content');
    }
    // Save valid content
    const extDir = path.join(preloadDir, getUrlAsPath(ext.url));
    const extPath = path.join(extDir, 'extension.mjs');
    fs.mkdirSync(extDir, {recursive: true});
    fs.writeFileSync(
        extPath,
        content
    );
    ext.path = path.relative(preloadDir, extPath);
};

// Preload extensions
const preload = async () => {
    fs.mkdirSync(preloadDir, {recursive: true});
    const downloadedExtensions = []; // Track downloaded extensions
    try {
        // Download the approved extension
        for (const url of rules.approved) {
            const approvedExt = {url: url};
            try {
                await downloadExtension(approvedExt);
                downloadedExtensions.push(approvedExt);
            } catch (error) {
                console.warn(`Failed to process approved extension ${url}:`, error.message);
                continue; // Skip to next approved extension
            }
        }


        // Fetch extension list from Xcratch Extension Collector
        const response = await fetchWithTimeout(process.env.XCRATCH_LIST_URL);
        const extensions = await response.json();
        // Sort by count in descending order
        extensions.sort((a, b) => b.count - a.count);
        for (const ext of extensions) {
            if (downloadedExtensions.every(downloadedExt => downloadedExt.url === ext.url)) {
                console.info(`Approved extension: ${ext.url}`);
                continue; // Skip approved extensions
            }
            // Skip ignored URLs
            if (shouldIgnoreURL(ext.url) && !isAllowedURL(ext.url)) {
                console.info(`Skipping ignored extension: ${ext.url}`);
                continue;
            }
            // Check count of downloads
            if (ext.count < rules.minCount) {
                console.info(`Skipping extension with count < ${rules.minCount}: ${ext.url}`);
                continue;
            }
            const extObj = {url: ext.url};
            try {
                await downloadExtension(extObj);
                downloadedExtensions.push(extObj);
            } catch (error) {
                console.warn(`Failed to process extension ${ext.url}:`, error.message);
                continue; // Skip to next extension
            }
        }

        console.info('Preload complete');
    } finally {
        // Save updated JSON with only valid extensions
        fs.writeFileSync(
            path.join(preloadDir, 'preload.json'),
            JSON.stringify(downloadedExtensions, null, 2)
        );
    }
};

// Run preload
preload().then(
    () => process.exit(0),
    error => {
        console.error(error);
        process.exit(1);
    }
);
