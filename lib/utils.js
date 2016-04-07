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

/**
 * @method getModelName
 * @param {Object} model
 * @param {String} model.name - the model name
 * @param {String} model.base - the model base name 
 * @return {String} the processed string for name
 */
function getModelName(model) {
  let newName;
  if (model.base === 'PersistedModel' ||
    model.base === 'Model') {
    newName = pluralize(model.name);
  } else {
    newName = pluralize(model.base);
  }
  return newName;
}

exports.pluralize = pluralize;
exports.pluralize2 = pluralize2;
exports.getModelName = getModelName;
