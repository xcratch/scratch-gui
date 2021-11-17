#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const yargs = require('yargs')

const argv = yargs
    .option('vm',
        {
            description: 'path to scratch-vm',
            demandOption: true
        })
    .option('gui',
        {
            description: 'path to scratch-gui',
            default: './'
        })
    .version(false)
    .help()
    .argv

const VmRoot = path.resolve(process.cwd(), argv.vm);
const GuiRoot = path.resolve(process.cwd(), argv.gui);

// Make symbolic link
function makeSymbolicLink(to, from) {
    try {
        const stats = fs.lstatSync(from);
        if (stats.isSymbolicLink()) {
            if (fs.readlinkSync(from) === to) {
                console.log(`Already exists link: ${from} -> ${fs.readlinkSync(from)}`);
                return;
            }
            fs.unlink(from);
        } else {
            fs.renameSync(from, `${from}~`);
        }
    } catch (err) {
        // File not exists.
    }
    fs.symlinkSync(to, from, 'dir');
    console.log(`Make link: ${from} -> ${fs.readlinkSync(from)}`);
}

// Use local scratch-vm in scratch-gui
try {
    const VmModulePath = path.resolve(GuiRoot, './node_modules/scratch-vm');
    makeSymbolicLink(VmRoot, VmModulePath);
} catch (err) {
    console.error(err);
}
