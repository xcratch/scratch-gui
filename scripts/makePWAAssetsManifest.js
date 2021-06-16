/* eslint-disable no-undef */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const util = require('util');

const libraries = require('./lib/libraries');

const manifest = path.resolve(__dirname, '../src/assetsManifest.json');


const describe = function (object) {
    return util.inspect(object, false, Infinity, true);
};

const collectSimple = function (library, dest, debugLabel = 'Item') {
    library.forEach(item => {
        let md5Count = 0;
        if (item.md5) {
            ++md5Count;
            dest.add(item.md5);
        }
        if (item.baseLayerMD5) { // 2.0 library syntax for costumes
            ++md5Count;
            dest.add(item.baseLayerMD5);
        }
        if (item.md5ext) { // 3.0 library syntax for costumes
            ++md5Count;
            dest.add(item.md5ext);
        }
        if (md5Count < 1) {
            console.warn(`${debugLabel} has no MD5 property:\n${describe(item)}`);
        } else if (md5Count > 1) {
            // is this actually bad?
            console.warn(`${debugLabel} has multiple MD5 properties:\n${describe(item)}`);
        }
    });
    return dest;
};

const collectAssets = function (dest) {
    collectSimple(libraries.backdrops, dest, 'Backdrop');
    collectSimple(libraries.costumes, dest, 'Costume');
    collectSimple(libraries.sounds, dest, 'Sound');
    libraries.sprites.forEach(sprite => {
        if (sprite.costumes) {
            collectSimple(sprite.costumes, dest, `Costume for sprite ${sprite.name}`);
        }
        if (sprite.sounds) {
            collectSimple(sprite.sounds, dest, `Sound for sprite ${sprite.name}`);
        }
    });
    return dest;
};


const listAllAssets = function () {
    const allAssets = collectAssets(new Set());
    console.log(`Total library assets: ${allAssets.size}`);
    const urls = Array.from(allAssets).map(file =>
        ({
            url: `https://assets.scratch.mit.edu/internalapi/asset/${file}/get/`,
            revision: file.split('.').slice(0, -1)[0]
        }));
    fs.writeFile(manifest, JSON.stringify(urls, null, 2), (err) => {
        if (err) throw err;
        console.log('Assets Manifest has been saved!');
    });
};

listAllAssets();
