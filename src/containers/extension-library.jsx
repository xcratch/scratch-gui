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
        description: 'Prompt for unoffical extension url',
        id: 'gui.extensionLibrary.extensionUrl'
    },
    confirmReplacing: {
        defaultMessage: 'Do you want to replace extension\n\nextension name: {name}\nload from: {url}',
        description: 'Confirm for replacing of the extension',
        id: 'gui.extensionLibrary.confirmReplacingExtension'
    }
});

// Workaround to avoid official translation process.
const translations = {
    'ja': {
        'gui.extensionLibrary.confirmReplacingExtension': '拡張機能を置き換えますか?\n\n拡張機能名: {name}\n読み込み元: {url}'
    },
    'ja-Hira': {
        'gui.extensionLibrary.confirmReplacingExtension': 'かくちょうきのうをおきかえますか?\n\nかくちょうきのうめい: {name}\nよみこみもと: {url}'
    }
};

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
    }
    handleItemSelect (item) {
        let id = item.extensionId;
        const url = item.extensionURL ? item.extensionURL : id;
        if (!item.disabled && !id) {
            return prompt({
                message: this.props.intl.formatMessage(messages.extensionUrl),
                valueType: 'url',
                initialValue: 'https://example.com/module.mjs'
            })
                .then(inputUrl => this.props.vm.extensionManager.fetchExtension(inputUrl)
                    .then(({entry, blockClass}) => {
                        id = entry.extensionId;
                        const existingEntry = extensionLibraryContent.find(libEntry => libEntry.extensionId === id);
                        if (existingEntry) {
                            // Workaround to avoid official translation process.
                            Object.assign(
                                this.props.intl.messages,
                                translations[this.props.intl.locale]
                            );
                            return confirm({
                                message: this.props.intl.formatMessage(
                                    messages.confirmReplacing,
                                    {
                                        name: existingEntry.name.props ?
                                            this.props.intl.formatMessage(existingEntry.name.props) :
                                            existingEntry.name,
                                        url: inputUrl
                                    }
                                )}
                            ).then(doReplace => {
                                if (doReplace) {
                                    this.props.vm.extensionManager.registerExtensionBlock(entry, blockClass);
                                    this.props.onCategorySelected(id);
                                }
                                return Promise.resolve();
                            });
                        }
                        this.props.vm.extensionManager.registerExtensionBlock(entry, blockClass);
                        this.props.onCategorySelected(id);
                        return Promise.resolve();
                    })
                    .catch(error => {
                        log.error(`Error on fetch ${inputUrl}:\n${error.stack}\n`);
                        alert({message: `Could not get extension from:\n${inputUrl}`});
                    }))
                .catch(() => Promise.resolve());
        }
        if (id && !item.disabled) {
            if (this.props.vm.extensionManager.isExtensionLoaded(id)) {
                this.props.onCategorySelected(id);
            } else {
                this.props.vm.extensionManager.loadExtensionURL(url).then(() => {
                    this.props.onCategorySelected(id);
                });
            }
            return Promise.resolve();
        }
    }
    render () {
        const extensionLibraryThumbnailData = extensionLibraryContent.map(extension => ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        }));
        extensionLibraryContent.forEach(extension => {
            if (extension.translationMap) {
                Object.assign(
                    this.props.intl.messages,
                    extension.translationMap[this.props.intl.locale]
                );
            }
        });
        return (
            <LibraryComponent
                data={extensionLibraryThumbnailData}
                filterable={false}
                id="extensionLibrary"
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
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
