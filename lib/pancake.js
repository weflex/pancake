'use strict';

const Orgmode = require('orgmode');
const TypeParser = require('./type-parser');
const Meta = require('./meta');
const NativeTypes = require('./natives.json');
const Utils = require('./utils');
const Fs = require('fs');
const Path = require('path');
const sourceTmpl = Fs.readFileSync(
  Path.join(__dirname, './source.template.js'));
const builtInModels = require('./built-in-models.json');

function readConfig(pathname) {
  try {
    return JSON.parse(Fs.readFileSync(
      pathname + '/.pancakerc', 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * @module pancake
 */
module.exports = {
  
  /**
   * @module config
   * the current config object.
   */
  config: {
    /**
     * @property {Array} documents - the documents pathnames.
     */
    documents: [],
    /**
     * @property {Array} files - same to documents.
     */
    files: [],
    /**
     * @property {Array} plugins - the plugins to config
     */
    plugins: [],
  },

  /**
   * @method build
   * @param {String} pathname - the pathname to build the pancake document.
   * @param {Pancake} last - the Pancake instance to be merged.
   */
  build: function(pathname, last) {
    return (new Pancake())
      .merge(last).parseFromFilePath(pathname);
  },
  
  /**
   * @method pack
   * @param {String} pathname - the pathname to pick the pancakerc
   */
  pack: function(pathname) {
    this.config = readConfig(pathname);
    if (!this.config.documents && !this.config.files) {
      throw new TypeError('documents or files should be required to be an array');
    }

    let last;
    // building the documents together with each others
    this.config.documents.forEach((dir) => {
      const _srcPath = Path.join(pathname, dir);
      last = this.build(_srcPath, last);
    });
    // in last
    if (!last) {
      throw new TypeError('invalid program');
    }

    // write to file
    return last.complete();
  },
};

/**
 * This is the pancake class definition
 *
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
   * Add a weflex/neaty's validation
   *
   * @method addValidation
   * @param {String} type
   * @param {Object} prop
   * @param {String} modelId
   * @param {Boolean} isEmbeddable
   * @param {Array} args - the arguments for validation
   * @return {String} return the type
   */
  addValidation(type, prop, modelId, isEmbeddable, args) {
    this._validations.push({
      modelId,
      isEmbeddable,
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
   * @param {String} modelId
   * @param {Boolean} isEmbeddable
   * @param {Array} relation
   */
  addRelation(modelId, isEmbeddable, relation) {
    if (isEmbeddable) {
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
   * @param {Pancake} obj
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
    const outlines = r.findByTitle('EMBEDDABLES');
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
   * @chain
   * @param {Function} iterator
   * @param {String} iterator.name - the mode id
   * @param {String} iterator.models
   * @return {Pancake}
   */
  forEach(iterator) {
    if (typeof iterator !== 'function') {
      throw new TypeError('iterator required to be a function');
    }
    for (let name in this._embeds) {
      iterator('Embeddable.' + name, this._embeds[name]);
    }
    for (let name in this._models) {
      iterator('Model.' + name, this._models[name]);
    }
    return this;
  }

  /**
   * @method _tryBuild
   * @param {Object} metadata - the metadata to build.
   * @param {String} metadata.name - the model or embedable name.
   * @param {String} metadata.base - the model or embedable base.
   * @param {Array} props - the props from table.
   * @param {Boolean} isEmbeddable - if this option is true, we will skip some
   *                                of runtimes from models.
   */
  _tryBuild(metadata, props, isEmbeddable) {
    if (!metadata.name) {
      // if metadata is not defined, skip this build
      return;
    }
    const properties = {};
    const indexes = {};
    const security = {
      _: '',  // for all fields
    };

    let plural, baseModel;
    if (!isEmbeddable) {
      if (builtInModels.indexOf(metadata.base) >= 0) {
        // overriding base models shipped with Loopback
        plural = Utils.pluralize(metadata.base);
      } else {
        plural = Utils.pluralize(metadata.name);
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
        if (!security._ || security._ === prop.security) {
          security._ = prop.security;
        }

        if (prop.unique === true) {
          indexes[`unique_${name}`] = {
            keys: {
              [name]: 1
            },
            options: {
              unique: true,
            },
          };
        }
      } else if (!propTypeResult.status) {
        // We assume this to be a relation belongsTo
        if (isEmbeddable || this._embeds[prop.type]) {
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
        const newArgs = [prop, metadata.name, isEmbeddable].concat(propTypeValue.args);
        const result = fn.apply(this, newArgs);
        if (typeof result !== 'undefined') {
          type = result;
        }
      }

      if (type !== undefined) {
        let defaultValue = prop.default;
        let defaultFn = undefined;
        if (defaultValue === null || defaultValue === 'null') {
          defaultValue = undefined;
        }
        // TODO(Yorkie): should convert type by array's first element.
        if (defaultValue && !Array.isArray(type)) {
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

    let acls;
    if (!isEmbeddable) {
      const roles = ['owner', 'admin', 'other'];
      acls = [
        {
          accessType: '*',
          principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'DENY',
        },
        {
          accessType: '*',
          principalType: 'ROLE',
          principalId: '$authenticated',
          permission: 'ALLOW',
        },
      ];
    }

    const attach = isEmbeddable ? this._embeds : this._models;
    if (!attach[metadata.name]) {
      attach[metadata.name] = {};
    }
    Object.defineProperties(attach[metadata.name], {
      name: {
        enumerable: true,
        value: metadata.name,
      },
      base: {
        enumerable: true,
        value: baseModel,
      },
      indexes: {
        enumerable: true,
        value: indexes,
      },
      plural: {
        enumerable: true,
        value: plural,
      },
      strict: {
        enumerable: true,
        value: true,
      },
      idInjection: {
        enumerable: true,
        value: true,
      },
      options: {
        enumerable: true,
        value: {
          validateUpsert: true,
        },
      },
      properties: {
        enumerable: true,
        writable: true,
        value: properties,
      },
      validations: {
        enumerable: true,
        writable: true,
        value: [],
      },
      relations: {
        enumerable: true,
        writable: true,
        value: {},
      },
      acls: {
        enumerable: true,
        writable: true,
        value: acls
      },
      source: {
        enumerable: false,
        value: sourceTmpl
      }
    });
  }

  /**
   * @method _completeValidation
   * @private
   */
  _completeValidations() {
    this._validations.forEach((item) => {
      const host = item.isEmbeddable ? this._embeds : this._models;
      const model = host[item.modelId];
      if (model) {
        model.properties[item.validation.property].type = item.propertyType;
        model.validations.push(item.validation);
      }
    });
  }

  /**
   * @method _completeRelations
   * @private
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
   * Call this function after all building process has been done
   * 
   * @method complete
   */
  complete() {
    this.stillNotCompleteRelations.forEach((item) => {
      let oldName = '';
      const model = this._models[item.relation.model];
      if (!model) {
        return;
      }
      for (let name in model.relations) {
        const rel = model.relations[name];
        if (rel.type === 'hasMany' && rel.model === item.modelId) {
          oldName = name;
          delete model.relations[oldName];
          break;
        }
      }
      // update the foreign key
      const foreignKey = item.relation.foreignKey ||
        Utils.getModelName(model);
      const newName = oldName ||
        Utils.getModelName(this._models[item.modelId]);
      model.relations[newName] = {
        type: 'hasMany',
        model: item.modelId,
        foreignKey,
      };
    });
    return this;
  }

}
