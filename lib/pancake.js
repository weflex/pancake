'use strict';

const Orgmode = require('orgmode');
const TypeParser = require('./type-parser');
const Meta = require('./meta');
const NativeTypes = require('./natives.json');
const Utils = require('./utils');

/**
 * @class Pancake
 */
class Pancake {
  
  /**
   * @constructor
   */
  constructor() {
    this._metadata = null;
    this._embeds = {};
    this._models = {};
    this._validations = [];
    this._relations = [];
    this.stillNotCompleteRelations = [];
  }
  
  /**
   * @method addValidation
   */
  addValidation(type, prop, modelId, isEmbedable, args) {
    this._validations.push({
      modelId,
      isEmbedable,
      propertyType: 'String',
      validation: {
        property: prop.attr,
        name: type,
        args: {
          'in': args
        },
      },
    });
    return 'String';
  }
  
  /**
   * @method addRelation
   */
  addRelation(modelId, isEmbedable, relation) {
    if (isEmbedable) {
      return;
    }
    this._relations.push({
      modelId,
      relation,
    });
  }

  /**
   * Merge two Pancake objects
   * @method merge
   */
  merge(obj) {
    if (!obj || !(obj instanceof Pancake)) {
      return this;
    }
    this._embeds = Object.assign(this._embeds, obj._embeds);
    this._models = Object.assign(this._models, obj._models);
    this._validations = this._validations.concat(obj._validations);
    this._relations = this._relations.concat(obj._relations);
    this.stillNotCompleteRelations =
      this.stillNotCompleteRelations.concat(obj.stillNotCompleteRelations);
    return this;
  }

  /**
   * @method parseFromFilePath
   * @param {String} pathname
   * @return {Object} returns the parsed object.
   */
  parseFromFilePath(pathname) {
    const r = new Orgmode(pathname);
    this._metadata = r.overview;
    this._parseEmbeds(r);
    this._parseModels(r);
    this._completeValidations();
    this._completeRelations();
    return this;
  }

  /**
   * @method _getMetadata
   * @private
   * @param {Array} options - the options to generate metadata
   */
  _getMetadata(options, extendObj) {
    const metadata = {};
    for (let item of options) {
      metadata[item.name.toLowerCase()] = item.value;
    }
    return Object.assign(extendObj || {}, metadata);
  }

  /**
   * @method _parseEmbeds
   * @private
   */
  _parseEmbeds(r) {
    const outlines = r.findByTitle('EMBEDABLE');
    if (!outlines || outlines.length === 0) {
      return this;
    }
    for (let table of outlines[0].children.tables) {
      const metadata = this._getMetadata(table.options);
      this._tryBuild(metadata, table.rows, true);
    }
  }

  /**
   * @method _parseModels
   * @private
   */
  _parseModels(r) {
    const outlines = r.findByTitle('MODELS');
    if (!outlines || outlines.length === 0) {
      return this;
    }
    for (let table of outlines[0].children.tables) {
      let metadata = this._getMetadata(table.options, {
        base: 'PersistedModel',
      });
      this._tryBuild(metadata, table.rows, false);
    }
  }

  /**
   * Foreach of every models generated
   * @method forEach
   */
  forEach(iterator) {
    if (typeof iterator !== 'function') {
      throw new TypeError('iterator required to be a function');
    }
    for (let name in this._embeds) {
      iterator('Embedable.' + name, this._embeds[name]);
    }
    for (let name in this._models) {
      iterator('Models.' + name, this._models[name]);
    }
    return this;
  }

  /**
   * @method _tryBuild
   * @param {Object} metadata - the metadata to build.
   * @param {String} metadata.name - the model or embedable name.
   * @param {String} metadata.base - the model or embedable base.
   * @param {Array} props - the props from table.
   * @param {Boolean} isEmbedable - if this option is true, we will skip some
   *                                of runtimes from models.
   */
  _tryBuild(metadata, props, isEmbedable) {
    const properties = {};

    let plural, baseModel;
    if (!isEmbedable) {
      if (metadata.base === 'PersistedModel') {
        plural = Utils.pluralize(metadata.name);
      } else {
        plural = Utils.pluralize(metadata.base);
      }
      baseModel = metadata.base;
    } else {
      baseModel = 'Model';
    }

    props.forEach((prop) => {
      let type = undefined;
      let name = prop.attr;
      let relationType;
      const propTypeResult = TypeParser.parse(prop.type);
      if (typeof propTypeResult === 'string') {
        // for Native types: Number|String|Boolean|Date|...
        type = propTypeResult;
      } else if (!propTypeResult.status) {
        // We assume this to be a relation belongsTo
        if (isEmbedable || this._embeds[prop.type]) {
          type = prop.type;
        } else {
          Meta.BelongsTo.call(this, prop, metadata.name, false);
          type = prop.type;
        }
      } else {
        const propTypeValue = propTypeResult.value;
        const fn = Meta[propTypeValue.name];
        if (typeof fn !== 'function') {
          throw new TypeError(propTypeValue.name + ' is not defined in metatypes');
        }
        const newArgs = [prop, metadata.name, isEmbedable].concat(propTypeValue.args);
        const result = fn.apply(this, newArgs);
        if (typeof result !== 'undefined') {
          type = result;
        }
      }

      if (type !== undefined) {
        let defaultValue = prop.default;
        let defaultFn = undefined;
        if (defaultValue === null) {
          defaultValue = undefined;
        }
        // TODO(Yorkie): should convert type by array's first element.
        if (!Array.isArray(type)) {
          // if the type is not an array, don't check for default
          // value.
          switch (type.toLowerCase()) {
            case 'date':
              if (defaultValue === 'now' || !defaultValue) {
                defaultValue  = undefined;
                defaultFn     = 'now';
              } else {
                defaultValue = new Date(defaultValue);
              }
              break;
            case 'number':
              defaultValue = parseInt(defaultValue);
              break;
            case 'bool':
            case 'boolean':
              defaultValue = !!defaultValue;
              break;
            default:
              defaultValue = undefined;
              break;
          }
        }
        properties[name] = {
          type,
          required: prop.required ? true : undefined,
          default: defaultValue,
          defaultFn,
        };
      }
    });

    const attach = isEmbedable ? this._embeds : this._models;
    attach[metadata.name] = {
      name: metadata.name,
      base: baseModel,
      plural,
      strict: true,
      idInjection: true,
      indexes: {},
      options: {
        validateUpsert: true,
      },
      properties,
      validations: [],
      relations: {},
    };
  }

  /**
   * @method _completeValidation
   * @private
   */
  _completeValidations() {
    this._validations.forEach((item) => {
      const host = item.isEmbedable ? this._embeds : this._models;
      const model = host[item.modelId];
      if (model) {
        model.properties[item.validation.property].type = item.propertyType;
        model.validations.push(item.validation);
      }
    });
  }

  /**
   * @method _completeRelations
   */
  _completeRelations() {
    this._relations.forEach((item) => {
      const model = this._models[item.modelId];
      const result = item.relation();
      if (result) {
        const model = this._models[result.modelId];
        const props = model.properties;
        model.relations[result.name] = Object.assign(result.relation, {
          options: {
            validate: true,
          }
        });
        if (result.relation.type === 'belongsTo') {
          this.stillNotCompleteRelations.push(result);
        }
      }
    });
  }

  /**
   * @method complete
   */
  complete() {
    this.stillNotCompleteRelations.forEach((item) => {
      let isDuplicated = false;
      const model = this._models[item.relation.model];
      if (!model || !Array.isArray(model.relations)) {
        return;
      }
      for (let name in model.relations) {
        const rel = model.relations[name];
        if (rel.type === 'hasMany' && rel.model === item.modelId) {
          isDuplicated = true;
          break;
        }
      }
      if (!isDuplicated) {
        let foreignKey;
        if (model.base === 'PersistedModel') {
          foreignKey = pluralize(model.name);
        } else {
          foreignKey = pluralize(model.base);
        }
        model.relations[pluralize(item.name)] = {
          type: 'hasMany',
          model: item.modelId,
          foreignKey,
        };
      }
    });
    return this;
  }

}

module.exports = {
  build: function(pathname, last) {
    return (new Pancake())
      .merge(last).parseFromFilePath(pathname);
  },
};
