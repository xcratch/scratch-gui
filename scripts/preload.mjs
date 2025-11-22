import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import https from 'https';
import crossFetch from 'cross-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, '..');

const fetchTimeout = 30000; // [ms]

// Read preload rules
const rulesPath = path.join(__dirname, 'preload-rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// Create safe filename from URL
const getUrlAsPath = url => encodeURIComponent(url)
    .replace(/\./g, '%2E')
    .replace(/\//g, '%2F')
    .replace(/:/g, '%3A');

// Check if content is a valid Xcratch extension (entry or blockClass)
const isValidExtensionContent = content => {
    try {
        // Check if content is empty
        if (!content.trim()) return false;
        // Check for 'entry' or 'blockClass'
        return content.includes('entry') || content.includes('blockClass');
    } catch (error) {
        return false;
    }
};

// Check if content contains only entry (no blockClass)
const hasOnlyEntry = content => {
    try {
        return content.includes('entry') && !content.includes('blockClass');
    } catch (error) {
        return false;
    }
};

// Extract extensionURL from entry content
const extractExtensionURL = content => {
    try {
        // Match extensionURL property in the entry object
        const match = content.match(/extensionURL\s*:\s*['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
};

// Resolve extensionURL (handle relative paths)
const resolveExtensionURL = (extensionURL, baseURL) => {
    try {
        // If extensionURL is absolute, return as is
        if (extensionURL.startsWith('http://') || extensionURL.startsWith('https://')) {
            return extensionURL;
        }
        // If relative, resolve against baseURL
        const base = new URL(baseURL);
        return new URL(extensionURL, base).href;
    } catch (error) {
        return null;
    }
};

// Fetch with timeout
const fetchWithTimeout = async (url, timeout = fetchTimeout) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // For development HTTPS servers, disable certificate verification
    const agent = url.startsWith('https://') ?
        new https.Agent({rejectUnauthorized: false}) :
        null;
    
    try {
        const response = await crossFetch(url, {
            signal: controller.signal,
            agent: agent
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

const preloadDir = path.join(basePath, 'preload');

/**
 * Download extension to local
 * @param {string} url URL to download
 * @returns {string} relative path for the downloaded file
 */
const downloadExtension = async url => {
    console.info(`Downloading extension: ${url}`);
    const extResponse = await fetchWithTimeout(url);
    const content = await extResponse.text();
    // Validate content
    if (!isValidExtensionContent(content)) {
        throw new Error('Invalid extension content');
    }
    
    const extDir = path.join(preloadDir, getUrlAsPath(url));
    fs.mkdirSync(extDir, {recursive: true});
    
    // Check if content has only entry (no blockClass)
    if (hasOnlyEntry(content)) {
        console.info('  Entry-only content detected, saving as entry.mjs');
        // Save as entry.mjs
        const entryPath = path.join(extDir, 'entry.mjs');
        fs.writeFileSync(entryPath, content);
        
        // Extract extensionURL and download extension.mjs
        const extensionURL = extractExtensionURL(content);
        if (!extensionURL) {
            throw new Error('extensionURL not found in entry content');
        }
        
        // Resolve extensionURL (handle relative paths)
        const resolvedURL = resolveExtensionURL(extensionURL, url);
        if (!resolvedURL) {
            throw new Error('Failed to resolve extensionURL');
        }
        
        console.info(`  Downloading blockClass from: ${resolvedURL}`);
        const blockClassResponse = await fetchWithTimeout(resolvedURL);
        const blockClassContent = await blockClassResponse.text();
        
        // Validate blockClass content
        if (!blockClassContent.trim()) {
            throw new Error('Invalid blockClass content');
        }
        
        // Save as extension.mjs
        const extPath = path.join(extDir, 'extension.mjs');
        fs.writeFileSync(extPath, blockClassContent);
        return path.relative(preloadDir, extPath);
    }
    // Save as extension.mjs (original behavior)
    const extPath = path.join(extDir, 'extension.mjs');
    fs.writeFileSync(extPath, content);
    return path.relative(preloadDir, extPath);
    
};

// Preload extensions
const preload = async () => {
    fs.mkdirSync(preloadDir, {recursive: true});
    const downloadedExtensions = []; // Track downloaded extensions
    try {
        // Download the approved extension
        for (const url of rules.approved) {
            try {
                const extPath = await downloadExtension(url);
                downloadedExtensions.push({url: url, path: extPath});
            } catch (error) {
                console.warn(`Failed to process approved extension ${url}:`, error.message);
                continue; // Skip to next approved extension
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
