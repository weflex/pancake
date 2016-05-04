#!/usr/bin/env node

"use strict";

const fs = require('fs');
const path = require('path');
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
  if (srcPath && !accessSafe(srcPath)) {
    throw new Error(`${srcPath} is invalid`);
  }
  if (!accessSafe(dstPath)) {
    fs.mkdirSync(dstPath);
  }
}

if (argv.help || argv._.length === 0) {
  fs.createReadStream(__dirname + '/usage.txt').pipe(process.stderr);
} else {
  const srcPath = path.join(process.cwd(), argv._[0]);
  const isFile = fs.statSync(srcPath).isFile();
  if (isFile) {
    const dstPath = path.join(process.cwd(), argv.o || argv.out || './models');
    check(srcPath, dstPath);
    pancake.build(srcPath);
  } else {
    if (!accessSafe(srcPath + '/.pancakerc')) {
      throw new TypeError('.pancakerc is required');
    }
    const dstPath = path.join(process.cwd(), pancake.config.output || './models');
    check(null, dstPath);
    pancake.pack(srcPath).forEach((name, model) => {
      const pathnameNoExt = path.join(dstPath, name);
      fs.writeFileSync(
        `${pathnameNoExt}.json`,
        JSON.stringify(model, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        `${pathnameNoExt}.js`,
        model.source,
        'utf8'
      );
    });
  }
}
