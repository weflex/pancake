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

### What's PancakeD

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

### Get started with pancakeD

#### .pancakerc

The `.pancakerc` is a JSON file which lets us to define:

- which documents should be included into the model building.
- the output directory

#### document structure

Every document basically is consists of the following sections:

- *RECOMMENDED* OVERVIEW options: namely the top of this document that we define `AUTHOR`, `TITLE` and others, this is recommended content even if the pancake builder doesn't take this into.
- a *RECOMMENDED* top level headline named `STATUS OF THIS DOCUMENT`, that we will read the content there to get the document/specification status.
- a *RECOMMENDED* top level headline named `METATYPE`, that we will read it to generate meta types dynamically.
- a *RECOMMENDED* top level headline named `EMBEDABLE`, that we are using it to generate the embedable model.
- a *RECOMMENDED* top level headline named `MODELS` that we are using to build the models.

### Pancake Ecosystem

- [weflex/pancake-agent](https://github.com/weflex/pancake-agent) an agent library to execute the PTC(Pancake Target Code), which is based on loopback
- [weflex/pancake-sdk-javascript](https://github.com/weflex/pancake-sdk-javascript) The pancake SDK for JavaScript builder, this tool is a library and CLI to let you build JavaScript library to
connect your data store at browser-side.

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