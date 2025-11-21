import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import log from '../lib/log.js';

import extensionLibraryContent from '../lib/libraries/extensions/index.jsx';

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

import {prompt, confirm, alert} from '../lib/async-modal.jsx';

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    },
    extensionUrl: {
        defaultMessage: 'Enter the URL of the extension',
        description: 'Prompt for unofficial extension url',
        id: 'gui.extensionLibrary.extensionUrl'
    },
    confirmReplacing: {
        defaultMessage: 'Do you want to replace extension\n\nextension name: {name}\nload from: {url}',
        description: 'Confirm for replacing of the extension',
        id: 'xcratch.confirmReplacingExtension'
    },
    couldNotLoadExtension: {
        defaultMessage: 'Could not load extension from: ',
        description: 'Error message when extension could not be loaded',
        id: 'xcratch.couldNotLoadExtension'
    },
    functionTag: {
        defaultMessage: 'Function',
        description: 'Tag for filtering function enhancement extensions',
        id: 'xcratch.tag.function'
    },
    imageTag: {
        defaultMessage: 'Image',
        description: 'Tag for filtering visual enhancement extensions',
        id: 'xcratch.tag.image'
    },
    soundTag: {
        defaultMessage: 'Sound',
        description: 'Tag for filtering audio enhancement extensions',
        id: 'xcratch.tag.sound'
    },
    textTag: {
        defaultMessage: 'Text',
        description: 'Tag for filtering text enhancement extensions',
        id: 'xcratch.tag.text'
    },
    calculationTag: {
        defaultMessage: 'Calculation',
        description: 'Tag for filtering calculation enhancement extensions',
        id: 'xcratch.tag.calculation'
    },
    networkTag: {
        defaultMessage: 'Network',
        description: 'Tag for filtering network enhancement extensions',
        id: 'xcratch.tag.network'
    },
    deviceTag: {
        defaultMessage: 'Device',
        description: 'Tag for filtering device enhancement extensions',
        id: 'xcratch.tag.device'
    },
    aiTag: {
        defaultMessage: 'AI',
        description: 'Tag for filtering AI enhancement extensions',
        id: 'xcratch.tag.ai'
    }
});

// Workaround to avoid official translation process.
const translations = {
    'ja': {
        'xcratch.confirmReplacingExtension': '拡張機能を置き換えますか?\n\n拡張機能名: {name}\n読み込み元: {url}',
        'xcratch.couldNotLoadExtension': '拡張機能をロードできませんでした: {url}',
        'xcratch.category.loaded': '読み込み済み',
        'xcratch.category.preloaded': '先読み済み',
        // Tags for filtering extensions
        'xcratch.tag.function': '機能',
        'xcratch.tag.image': '画像',
        'xcratch.tag.sound': '音',
        'xcratch.tag.text': 'テキスト',
        'xcratch.tag.calculation': '計算',
        'xcratch.tag.network': 'ネットワーク',
        'xcratch.tag.device': 'デバイス',
        'xcratch.tag.ai': 'AI'
    },
    'ja-Hira': {
        'xcratch.confirmReplacingExtension': 'かくちょうきのうをおきかえますか?\n\nかくちょうきのうめい: {name}\nよみこみもと: {url}',
        'xcratch.couldNotLoadExtension': 'かくちょうきのうをロードできませんでした: {url}',
        'xcratch.category.loaded': 'よみこみずみ',
        'xcratch.category.preloaded': 'さきよみずみ',
        // Tags for filtering extensions
        'xcratch.tag.function': 'きのう',
        'xcratch.tag.image': 'がぞう',
        'xcratch.tag.sound': 'おと',
        'xcratch.tag.text': 'テキスト',
        'xcratch.tag.calculation': 'けいさん',
        'xcratch.tag.network': 'ネットワーク',
        'xcratch.tag.device': 'デバイス',
        'xcratch.tag.ai': 'AI'
    }
};

/**
 * Holds the preloaded extensions
 * @type {Array<{entry: Object, blockClass: Object|null, url: string,
 * isSeparate: boolean, blockClassContextKey?: string}>}
 */
let preloadedExtensions = [];
let preloaded = false;

/**
 * Load preloaded extensions
 * @returns {Promise<Array<object>>} Preloaded extensions
 */
const loadModules = async () => {
    try {
        let extensions = [];
        try {
            // Check if preload.json exists at compile time and load it.
            const preloadContext = require.context(
                '../../preload',
                false,
                /^\.\/preload\.json$/,
                'lazy'
            );
            if (preloadContext.keys().includes('./preload.json')) {
                const preloadJson = await preloadContext('./preload.json');
                extensions = preloadJson.default || preloadJson;
            }
        } catch (e) {
            // This can happen if the preload directory does not exist.
            extensions = [];
        }
        
        if (!Array.isArray(extensions)) {
            log.warn('Invalid preload.json format');
            return preloadedExtensions;
        }

        // Create webpack context for preload directory (both entry.mjs and extension.mjs)
        let preloadModulesContext = null;
        try {
            preloadModulesContext = require.context(
                '../../preload',
                true,
                /\/(entry|extension)\.mjs$/,
                'lazy'
            );
        } catch (contextError) {
            return preloadedExtensions;
        }

        // Skip if no extensions to load
        if (extensions.length === 0) {
            return preloadedExtensions;
        }

        // Group files by directory
        const filesByDirectory = new Map();
        preloadModulesContext.keys().forEach(key => {
            const match = key.match(/^\.\/(.+)\/(entry|extension)\.mjs$/);
            if (match) {
                const [, dirPath, fileType] = match;
                if (!filesByDirectory.has(dirPath)) {
                    filesByDirectory.set(dirPath, {});
                }
                filesByDirectory.get(dirPath)[fileType] = key;
            }
        });

        // Load each extension module using webpack context
        const modules = await Promise.all(
            extensions.map(async ext => {
                try {
                    // Extract directory path from ext.path
                    const pathMatch = ext.path.match(/^(.+)\/(entry|extension)\.mjs$/);
                    if (!pathMatch) {
                        log.warn(`Invalid extension path format: ${ext.path}`);
                        return null;
                    }
                    
                    const dirPath = pathMatch[1];
                    const filesInDir = filesByDirectory.get(dirPath);
                    
                    if (!filesInDir) {
                        log.warn(`No files found for extension: ${ext.path}`);
                        return null;
                    }

                    // Determine if integrated or separate type
                    const hasEntry = !!filesInDir.entry;
                    const hasExtension = !!filesInDir.extension;
                    const isSeparate = hasEntry && hasExtension;

                    if (isSeparate) {
                        // Separate type: load only entry.mjs
                        const entryModule = await preloadModulesContext(filesInDir.entry);
                        return {
                            entry: entryModule.entry,
                            blockClass: null,
                            url: ext.url,
                            isSeparate: true,
                            blockClassContextKey: filesInDir.extension
                        };
                    }
                    if (hasExtension) {
                        // Integrated type: load extension.mjs with both entry and blockClass
                        const extensionModule = await preloadModulesContext(filesInDir.extension);
                        return {
                            entry: extensionModule.entry,
                            blockClass: extensionModule.blockClass,
                            url: ext.url,
                            isSeparate: false
                        };
                    }
                    log.warn(`Invalid extension structure for: ${ext.path}`);
                    return null;
                } catch (error) {
                    log.warn(`Failed to load extension ${ext.url}:`, error);
                    return null;
                }
            })
        );

        // Filter out failed loads
        preloadedExtensions = modules.filter(module => module && module.entry);

        // Sort by name
        preloadedExtensions.sort((a, b) => {
            const nameA = a.entry.name.defaultMessage ?
                a.entry.name.defaultMessage :
                a.entry.name;
            const nameB = b.entry.name.defaultMessage ?
                b.entry.name.defaultMessage :
                b.entry.name;
            return nameA.localeCompare(nameB);
        });

        // Register all preloaded extensions to the library
        preloadedExtensions.forEach(({entry, url}) => {
            entry.category = 'preloaded';
            entry.extensionURL = url;
            // Check if extension is already in the library to prevent duplicates
            const existingIndex = extensionLibraryContent.findIndex(
                item => item.extensionId === entry.extensionId ||
                        (item.extensionURL && item.extensionURL === url)
            );
            if (existingIndex === -1) {
                extensionLibraryContent.push(entry);
            }
        });

        return preloadedExtensions;
    } catch (error) {
        log.info('Error loading preloaded extensions:', error);
        return preloadedExtensions;
    }
};

// Load preloaded extensions
loadModules().then(extensions => {
    log.info('Extensions preloaded:', extensions.map(({entry}) => entry.extensionId));
});

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        extensionLibraryContent.forEach(extension => {
            if (extension.setFormatMessage) {
                extension.setFormatMessage(this.props.intl.formatMessage);
            }
            if (extension.translationMap) {
                Object.assign(
                    this.props.intl.messages,
                    extension.translationMap[this.props.intl.locale]
                );
            }
        });
        bindAll(this, [
            'handleItemSelect'
        ]);
        
        if (!preloaded) {
            // Set preloaded extensions into VM for fallback when loading extension class from URL.
            // Only register integrated type extensions (those with blockClass already loaded)
            preloadedExtensions.forEach(({entry, blockClass, isSeparate, url}) => {
                if (!isSeparate && blockClass) {
                    log.info(`Registering preloaded integrated extension: ${entry.extensionId} with URL: ${url}`);
                    this.props.vm.extensionManager
                        .registerExtensionBlock(entry, blockClass, true); // true: preloaded
                }
            });
            // Clear preloadedExtensions to avoid duplicate registration.
            preloaded = true;
        }
        // Workaround to avoid official translation process.
        Object.assign(
            this.props.intl.messages,
            translations[this.props.intl.locale]
        );
    }

    async handleItemSelect (item) {
        if (item.disabled) {
            return;
        }
        let id = item.extensionId;
        const url = item.extensionURL ? item.extensionURL : id;
        if (id) {
            if (this.props.vm.extensionManager.isExtensionLoaded(id)) {
                this.props.onCategorySelected(id);
                return Promise.resolve();
            }
            
            // Check if this is a preloaded extension
            const preloadedExt = preloadedExtensions.find(ext => ext.entry.extensionId === id);
            
            if (preloadedExt && preloadedExt.isSeparate && preloadedExt.blockClassContextKey) {
                // Separate type preloaded extension
                try {
                    // Load blockClass dynamically for separate type extension
                    const preloadContext = require.context(
                        '../../preload',
                        true,
                        /\/(entry|extension)\.mjs$/,
                        'lazy'
                    );
                    
                    const extensionModule = await preloadContext(preloadedExt.blockClassContextKey);
                    
                    if (extensionModule && extensionModule.blockClass) {
                        // Register the blockClass to VM
                        this.props.vm.extensionManager
                            .registerExtensionBlock(preloadedExt.entry, extensionModule.blockClass);
                        this.props.onCategorySelected(id);
                    } else {
                        throw new Error('blockClass not found in extension module');
                    }
                } catch (error) {
                    log.warn(`Failed to dynamically load blockClass for ${id}:`, error);
                    // Fallback to loading from URL
                    return this.props.vm.extensionManager.loadExtensionURL(url)
                        .then(() => {
                            this.props.onCategorySelected(id);
                        });
                }
                return;
            }
            
            // Not a preloaded extension - load from URL
            return this.props.vm.extensionManager.loadExtensionURL(url)
                .then(() => {
                    this.props.onCategorySelected(id);
                });
        }
        let inputUrl = url;
        return prompt(
            {
                message: this.props.intl.formatMessage(messages.extensionUrl),
                valueType: 'url',
                initialValue: 'https://xcratch.github.io/xcx-example/dist/xcratchExample.mjs'
            })
            .then(userInput => {
                inputUrl = userInput;
                return this.props.vm.extensionManager.fetchExtension(userInput);
            })
            .then(({entry, blockClass}) => {
                id = entry.extensionId;
                const existingEntry = extensionLibraryContent.find(libEntry => libEntry.extensionId === id);
                if (existingEntry) {
                    return confirm(
                        {
                            message: this.props.intl.formatMessage(
                                messages.confirmReplacing,
                                {
                                    name: existingEntry.name.props ?
                                        this.props.intl.formatMessage(existingEntry.name.props) :
                                        existingEntry.name,
                                    url: blockClass.extensionURL
                                }
                            )
                        })
                        .then(doReplace => {
                            if (doReplace) {
                                this.props.vm.extensionManager.registerExtensionBlock(entry, blockClass);
                                this.props.onCategorySelected(id);
                            }
                        });
                }
                this.props.vm.extensionManager.registerExtensionBlock(entry, blockClass);
                this.props.onCategorySelected(id);
            })
            .catch(error => {
                log.info(`Error on load extension class from ${inputUrl}:\n${error.stack}\n`);
                alert({
                    message: this.props.intl.formatMessage(
                        messages.couldNotLoadExtension,
                        {url: inputUrl}
                    )
                });
                return;
            });
        
    }
    render () {
        const extensionLibraryThumbnailData = extensionLibraryContent.map(extension => ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        }));
        return (
            <LibraryComponent
                data={extensionLibraryThumbnailData}
                filterable
                id="extensionLibrary"
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
                withCategories
                tags={[
                    {tag: 'image', intlLabel: messages.imageTag},
                    {tag: 'sound', intlLabel: messages.soundTag},
                    {tag: 'text', intlLabel: messages.textTag},
                    {tag: 'calculation', intlLabel: messages.calculationTag},
                    {tag: 'network', intlLabel: messages.networkTag},
                    {tag: 'device', intlLabel: messages.deviceTag},
                    {tag: 'function', intlLabel: messages.functionTag},
                    {tag: 'ai', intlLabel: messages.aiTag}
                ]}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onRequestClose: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

export default injectIntl(ExtensionLibrary);
