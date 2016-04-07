'use strict';

/**
 * Pancake utilities
 * @module pancake.utils
 */

const Inflection = require('inflection');

/**
 *
 * @method pluralize
 * @param {String} name
 * @return {String}
 */
function pluralize(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is required to be a string');
  }
  return Inflection
    .transform(name, ['pluralize', 'underscore', 'dasherize'])
    .toLowerCase();
};

/**
 *
 * @method pluralize2
 * @param {String} name
 * @return {String}
 */
function pluralize2(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is required to be a string');
  }
  return Inflection.singularize(name) + 'Ids';
}

exports.pluralize = pluralize;
exports.pluralize2 = pluralize2;