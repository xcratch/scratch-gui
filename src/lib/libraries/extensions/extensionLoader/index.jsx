import React from 'react';
import {FormattedMessage} from 'react-intl';

import iconImage from './extensionLoader.png';
import insetImage from './extensionLoader-small.svg';

const translationMap = {
    'ja': {
        'gui.extension.extensionLoader.name': '拡張機能を読み込む',
        'gui.extension.extensionLoader.description': '拡張機能をインターネットから読み込む。'
    },
    'ja-Hira': {
        'gui.extension.extensionLoader.name': 'かくちょうきのうをよみこむ',
        'gui.extension.extensionLoader.description': 'かくちょうきのうをインターネットからよみこむ。'
    }
};

export default {
    name: (
        <FormattedMessage
            defaultMessage="Extension Loader"
            description="Name for the extension loader selector"
            id="gui.extension.extensionLoader.name"
        />
    ),
    iconURL: iconImage,
    insetIconURL: insetImage,
    description: (
        <FormattedMessage
            defaultMessage="Load extension from internet."
            description="Description for the extension loader selector"
            id="gui.extension.extensionLoader.description"
        />
    ),
    featured: true,
    disabled: false,
    internetConnectionRequired: true,
    collaborator: 'Yengawa Lab',
    helpLink: 'https://lab.yengawa.com/project/scratch-loadable-extension/',
    translationMap: translationMap
};
