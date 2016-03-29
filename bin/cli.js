#!/usr/bin/env node

"use strict";

const fs = require('fs');
const path = require('path');
// const debug = require('debug')('pancake');
const argv = require('minimist')(process.argv.slice(2));
const pancake = require('../');

function accessSafe(pathname) {
  try {
    fs.accessSync(pathname);
    return true;
  } catch (err) {
    return false;
  }
}

function check(srcPath, dstPath) {
  if (!accessSafe(srcPath)) {
    throw new Error(`${srcPath} is invalid`);
  }
  if (!accessSafe(dstPath)) {
    fs.mkdirSync(dstPath);
  }
}

function build(srcPath, dstPath, last) {
  return pancake
    .build(srcPath, last)
    .forEach((name, model) => {
      const pathname = path.join(dstPath, name + '.json');
      // debug('wrote a json file to ' + pathname);
      fs.writeFileSync(
        pathname,
        JSON.stringify(model, null, 2),
        'utf8'
      );
    });
}

if (argv.help || argv._.length === 0) {
  fs.createReadStream(__dirname + '/usage.txt').pipe(process.stderr);
} else {
  const srcPath = path.join(process.cwd(), argv._[0]);
  const isFile = fs.statSync(srcPath).isFile();
  if (isFile) {
    const dstPath = path.join(process.cwd(), argv.o || argv.out || './models');
    check(srcPath, dstPath);
    build(srcPath, dstPath);
  } else {
    if (!accessSafe(srcPath + '/.pancakerc')) {
      throw new TypeError('.pancakerc is required');
    }
    const config = JSON.parse(fs.readFileSync(srcPath + '/.pancakerc', 'utf8'));
    if (!config.documents && !config.files) {
      throw new TypeError('documents or files should be required to be an array');
    }
    const dstPath = path.join(process.cwd(), config.output || './models');
    let last;
    config.documents.forEach((dir) => {
      const _srcPath = path.join(srcPath, dir);
      const _previous = 
      check(_srcPath, dstPath);
      last = build(_srcPath, dstPath, last);
    });
  }
}
