#!/usr/bin/env node

"use strict";

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const PancakeBuilder = require('../lib/build').PancakeBuilder;

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

function build(srcPath, dstPath) {
  function output(prefix, data) {
    for (let key in data) {
      let item = data[key];
      let name = item.name.toLowerCase();
      const pathname = path.join(dstPath, `${prefix}.${name}.json`);
      fs.writeFile(pathname, JSON.stringify(item, null, 2));
    }
  }
  function ondone(metadata) {
    output('types', metadata.types);
    output('models', metadata.models);
  }
  const pancake = new PancakeBuilder(
    path.join(srcPath),
    {
      ondone: ondone
    }
  );
  pancake.build();
}

if (argv.help || argv._.length === 0) {
  fs.createReadStream(__dirname + '/usage.txt').pipe(process.stderr);
} else {
  const srcPath = path.join(process.cwd(), argv._[0]);
  const dstPath = path.join(process.cwd(), argv.o || argv.out || './models');
  check(srcPath, dstPath);
  build(srcPath, dstPath);
}
