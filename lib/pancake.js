'use strict';

const Orgmode = require('orgmode');
const Parsimmon = require('parsimmon');
const Inflection = require('inflection');

const string = Parsimmon.string;
const regex = Parsimmon.regex;
const succeed = Parsimmon.succeed;
const alt = Parsimmon.alt;
const seq = Parsimmon.seq;
const seqMap = Parsimmon.seqMap;
const lazy = Parsimmon.lazy;
const eof = Parsimmon.eof;
const ignore = regex(/\s*/m);

function lexeme(p) { 
  return p.skip(ignore);
}

function pluralize(name) {
  if (typeof name !== 'string') {
    throw new TypeError('name is required to be a string');
  }
  return Inflection
    .transform(name, ['pluralize', 'dasherize'])
    .toLowerCase();
};
const NativeTypes = {
  'string'  : 'String',
  'number'  : 'Number',
  'bool'    : 'Boolean',
  'boolean' : 'Boolean',
  'array'   : 'Array',
  'date'    : 'Date',
};

/**
 * @class TypeParser
 */
class TypeParser {

  /**
   * @method parse
   * @static
   */
  static parse(str) {
    const p = new TypeParser(str);
    return p.parse();
  }

  /**
   * @constructor
   */
  constructor(str) {
    Object.defineProperties(this, {
      _str: {
        get: () => str
      },
    });
  }

  /**
   * @method parse
   */
  parse() {
    const nativeId = NativeTypes[this._str.toLowerCase()];
    if (typeof nativeId === 'string') {
      return nativeId;
    }
    const meta = lazy(() => {
      const comma = lexeme(string(','));
      const left = lexeme(string('('));
      const right = lexeme(string(')'));
      const name = lexeme(regex(
        /(hasMany|belongsTo|enum|range)/i));
      const param = lexeme(regex(/[a-z_0-9]+/i));
      const paramWithComma = comma.then(param);
      const params = seq(param, paramWithComma.many()).map((val) => {
        return [val[0]].concat(val[1]);
      });
      const value = seq(left, params, right).map((val) => val[1]);
      return seq(name, value).map((val) => {
        return {
          name: val[0],
          args: val[1],
        };
      });
    });
    return meta.parse(this._str);
  }
}

/**
 * @class Meta
 */
class Meta {

  /**
   * @method hasOne
   */
  static hasOne(prop, modelId, isEmbedable) {
    throw new Error('not implemented');
  }

  /**
   * @method hasMany
   */
  static hasMany(prop, modelId, isEmbedable, referenceTo) {
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
   * @method belongsTo
   */
  static belongsTo(prop, modelId, isEmbedable) {
    return this.addRelation(modelId, isEmbedable, () => {
      const foreignKey = prop.attr + 'Id';

      // change the property name to foreignKey
      const model = this._models[modelId];
      const properties = model.properties;
      if (properties[prop.attr]) {
        if (prop.required) {
          properties[foreignKey] = properties[prop.attr];
          properties[foreignKey].type = 'String';
        }
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
    this._validations = this._validations.concat(obj._validations);
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
        plural = pluralize(metadata.name);
      } else {
        plural = pluralize(metadata.base);
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
          Meta.belongsTo.call(this, prop, metadata.name, false);
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
        model.relations[result.name] = result.relation;
      }
    })
  }
}

module.exports = {
  build: function(pathname, last) {
    return (new Pancake())
      .merge(last).parseFromFilePath(pathname);
  },
};
