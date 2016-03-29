'use strict';

const NativeTypes = require('./natives.json');
const Utils = require('./utils');

/**
 * @class Meta
 */
class Meta {

  /**
   * @method Array
   */
  static Array(prop, modelId, isEmbedable, referenceTo) {
    if (this._embeds[referenceTo] ||
      NativeTypes[referenceTo.toLowerCase()]) {
      return [referenceTo];
    }
    return Meta.ReferencesMany.call(this, prop, modelId, false, referenceTo);
  }

  /**
   * @method HasOne
   */
  static HasOne(prop, modelId, isEmbedable) {
    throw new Error('not implemented');
  }

  /**
   * @method HasMany
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
   * @method ReferencesMany
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
   * @method BelongsTo
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
            default: prop.default,
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
   * @method Enum
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
   */
  static Range(prop, modelId, isEmbedable) {
    // TODO
    throw new Error('not implemented');
  }
}

module.exports = Meta;
