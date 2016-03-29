'use strict';

const Inflection = require('inflection');

function pluralize(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is required to be a string');
  }
  return Inflection
    .transform(name, ['pluralize', 'dasherize'])
    .toLowerCase();
};

function pluralize2(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is required to be a string');
  }
  return Inflection.singularize(name) + 'Ids';
}

exports.pluralize = pluralize;
exports.pluralize2 = pluralize2;