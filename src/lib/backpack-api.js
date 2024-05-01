import xhr from 'xhr';
import costumePayload from './backpack/costume-payload';
import soundPayload from './backpack/sound-payload';
import spritePayload from './backpack/sprite-payload';
import codePayload from './backpack/code-payload';
import md5 from 'js-md5';

const LOCAL_STORAGE_KEY = 'xcratchBackpack';

const includeLocalStorageURLs = item => Object.assign({}, item, {
    // scratch-storage uses `body` to determine the file type from its file extension
    // "wav" from "audio/wav" or "audio/x-wav"
    // "svg" from "image/svg+xml"
    body: `${item.id}.${item.mime.match(/(\/x-|\/)(\w+)/)[2]}`,
    thumbnailUrl: `data:image/jpeg;base64,${item.thumbnail}`,
    bodyUrl: `data:${item.mime};base64,${item.body}`
});

const getLocalStorageBackpackAssetURL = (host, id) => {
    const backpack = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]') || [];
    const found = backpack.find(entry => entry.id === id);
    if (!found) return false;
    return `data:${found.mime};base64,${found.body}`;
};

// Add a new property for the full thumbnail url, which includes the host.
// Also include a full body url for loading sprite zips
// TODO retreiving the images through storage would allow us to remove this.
const includeFullUrls = (item, host) => Object.assign({}, item, {
    thumbnailUrl: `${host}/${item.thumbnail}`,
    bodyUrl: `${host}/${item.body}`
});

const getBackpackContents = ({
    host,
    username,
    token,
    limit,
    offset
}) => new Promise((resolve, reject) => {
    if (host === 'localStorage') {
        const backpack = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]') || [];
        return resolve(backpack.slice(offset, offset + limit).map(item => includeLocalStorageURLs(item)));
    }
    xhr({
        method: 'GET',
        uri: `${host}/${username}?limit=${limit}&offset=${offset}`,
        headers: {'x-token': token},
        json: true
    }, (error, response) => {
        if (error || response.statusCode !== 200) {
            return reject(new Error(response.status));
        }
        return resolve(response.body.map(item => includeFullUrls(item, host)));
    });
});

const saveBackpackObject = ({
    host,
    username,
    token,
    type, // Type of object being saved to the backpack
    mime, // Mime-type of the object being saved
    name, // User-facing name of the object being saved
    body, // Base64-encoded body of the object being saved
    thumbnail // Base64-encoded JPEG thumbnail of the object being saved
}) => new Promise((resolve, reject) => {
    if (host === 'localStorage') {
        const backpack = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]') || [];
        const newEntry = {
            type,
            mime,
            name,
            body,
            thumbnail,
            id: md5(Date.now().toString())
        };
        backpack.unshift(newEntry);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backpack));
        return resolve(includeLocalStorageURLs(newEntry));
    }
    xhr({
        method: 'POST',
        uri: `${host}/${username}`,
        headers: {'x-token': token},
        json: {type, mime, name, body, thumbnail}
    }, (error, response) => {
        if (error || response.statusCode !== 200) {
            return reject(new Error(response.status));
        }
        return resolve(includeFullUrls(response.body, host));
    });
});

const deleteBackpackObject = ({
    host,
    username,
    token,
    id
}) => new Promise((resolve, reject) => {
    if (host === 'localStorage') {
        const backpack = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]') || [];
        const index = backpack.findIndex(entry => entry.id === id);
        if (index >= 0) {
            backpack.splice(index, 1);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backpack));
        }
        return resolve({ok: true});
    }
    xhr({
        method: 'DELETE',
        uri: `${host}/${username}/${id}`,
        headers: {'x-token': token}
    }, (error, response) => {
        if (error || response.statusCode !== 200) {
            return reject(new Error(response.status));
        }
        return resolve(response.body);
    });
});

// Two types of backpack items are not retreivable through storage
// code, as json and sprite3 as arraybuffer zips.
const fetchAs = (responseType, uri) => new Promise((resolve, reject) => {
    xhr({uri, responseType}, (error, response) => {
        if (error || response.statusCode !== 200) {
            return reject(new Error(response.status));
        }
        return resolve(response.body);
    });
});

// These two helpers allow easy fetching of backpack code and sprite zips
// Use the curried fetchAs here so the consumer does not worry about XHR responseTypes
const fetchCode = fetchAs.bind(null, 'json');
const fetchSprite = fetchAs.bind(null, 'arraybuffer');

export {
    getLocalStorageBackpackAssetURL,
    getBackpackContents,
    saveBackpackObject,
    deleteBackpackObject,
    costumePayload,
    soundPayload,
    spritePayload,
    codePayload,
    fetchCode,
    fetchSprite
};
