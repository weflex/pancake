# Pancake

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Dependency Status][david-image]][david-url]
[![Downloads][downloads-image]][downloads-url]

> Build your RESTFul service by writing document not code.

### Usage

```sh
$ pancake-cli [path/to/your/document] -o ./models
```

### What's Pancake

Pancake is mostly for developing a model system for the Node.js platform, so it of course contains
the ECMAScript's built-in types as:

- Number
- String
- Object
- Boolean

Pancake also owns the following features with love to build the all things:

- metatype: the metatype has the ability to make types.
- embedable: this type of models are not real for providing the RESTFul API, which is only used for
  presenting a data structure in other models.
- models: Every document may have a `MODELS` section which will be used for generating JSON that'd
  be accepted by neaty or other frameworks.

### Installation

```
npm install pancake -g
```

### License

MIT @ WeFlex, Inc.

[npm-image]: https://img.shields.io/npm/v/pancake.svg?style=flat-square
[npm-url]: https://npmjs.org/package/pancake
[travis-image]: https://img.shields.io/travis/weflex/pancake.svg?style=flat-square
[travis-url]: https://travis-ci.org/weflex/pancake
[david-image]: http://img.shields.io/david/weflex/pancake.svg?style=flat-square
[david-url]: https://david-dm.org/weflex/pancake
[downloads-image]: http://img.shields.io/npm/dm/pancake.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/pancake