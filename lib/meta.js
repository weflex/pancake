'use strict';
/**
 * @module pancake
 */

const NativeTypes = require('./natives.json');
const Utils = require('./utils');

/**
 * Meta function definitions
 * @class Meta
 */
class Meta {

  /**
   * The meta `Array` is for representing a built-ins array or a
   * `referencesMany` to other model
   *
   * @method Array
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   * @param {String} referenceTo
   * @return {Array|Undefined} return value depends on the referenceTo value.
   */
  static Array(prop, modelId, isEmbedable, referenceTo) {
    if (this._embeds[referenceTo] ||
      NativeTypes[referenceTo.toLowerCase()]) {
      return [referenceTo];
    }
    return Meta.ReferencesMany.call(this, prop, modelId, false, referenceTo);
  }

  /**
   * Mapping to the relation `hasOne` on weflex/neaty
   * @method HasOne
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   */
  static HasOne(prop, modelId, isEmbedable) {
    throw new Error('not implemented');
  }

  /**
   * Mapping to the relation `hasMany` on weflex/neaty
   * @method HasMany
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   * @param {String} referenceTo
   */
  static HasMany(prop, modelId, isEmbedable, referenceTo) {
    return this.addRelation(modelId, isEmbedable, () => {
      const model = this._models[modelId];
      let foreignKey;
      if (model.base !== 'PersistedModel') {
        foreignKey = model.base.toLowerCase() + 'Id';
      } else {
        foreignKey = model.name.toLowerCase() + 'Id';
      }

      return {
        modelId,
        name: prop.attr,
        relation: {
          type: 'hasMany',
          model: referenceTo,
          foreignKey,
        },
      };
    });
  }

  /**
   * Mapping to the relation `referencesMany` on weflex/neaty
   * @method ReferencesMany
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   * @param {String} referenceTo
   */
  static ReferencesMany(prop, modelId, isEmbedable, referenceTo) {
    return this.addRelation(modelId, isEmbedable, () => {
      const model = this._models[modelId];
      const foreignKey = Utils.pluralize2(prop.attr);
      model.properties[foreignKey] = {
        type: ['String'],
        required: prop.required ? true : undefined,
        default: [],
      };

      return {
        modelId,
        name: prop.attr,
        relation: {
          type: 'referencesMany',
          model: referenceTo,
          foreignKey,
        },
      };
    });
  }

  /**
   * Mapping to the relation `belongsTo` on weflex/neaty
   * @method BelongsTo
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   * @param {String} referenceTo
   */
  static BelongsTo(prop, modelId, isEmbedable) {
    return this.addRelation(modelId, isEmbedable, () => {
      const foreignKey = prop.attr + 'Id';

      // change the property name to foreignKey
      const model = this._models[modelId];
      const properties = model.properties;
      if (properties[prop.attr]) {
        properties[foreignKey] = Object.assign(
          properties[prop.attr], 
          {
            type: 'String',
            default: prop.default || undefined,
          }
        );
        delete properties[prop.attr];
      }

      // return the relation payload
      return {
        modelId,
        name: prop.attr,
        relation: {
          type: 'belongsTo',
          model: prop.type,
          foreignKey,
        },
      };
    });
  }

  /**
   * The meta `Enum` is for representing the options for string
   * @method Enum
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   */
  static Enum(prop, modelId, isEmbedable) {
    const args = [];
    for (let index = 3; index < arguments.length; index++) {
      args.push(arguments[index]);
    }
    return this.addValidation(
      'validatesInclusionOf', prop, modelId, isEmbedable, args);
  }

  /**
   * @method Range
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbedable
   */
  static Range(prop, modelId, isEmbedable) {
    // TODO
    throw new Error('not implemented');
  }
}

module.exports = Meta;
