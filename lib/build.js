"use strict";

const _ = require('lodash');
const orgmode = require('org-mode-parser');
const inflection = require('inflection');
const CSV = require('comma-separated-values');
const JavaScriptTypes = [
  'string',
  'number',
  'integer',
  'boolean',
  'date'
];

/**
 * @class PancakeBuilder
 */
class PancakeBuilder {
  /**
   * @constructor
   * @param {String} path - the document path
   * @param {Object} options - the options to parse and build models
   * @param {Function} ondone - fired when building is done
   */
  constructor(path, options) {
    this.options = Object.assign(options, {
      path,
    });
    this.query = null;
    this.metadata = {
      status: null,
      defaults: {},
      types: {},
      modelConfigs: {},
      models: {},
      builtins: {
        AccessToken: true,
        ACL: true,
        Application: true,
        Email: true,
        Role: true,
        RoleMapping: true,
        User: true,
        // custom models
        WeflexAccessToken: true,
        WeflexUserIdentity: true,
        WeflexUserCredential: true,
      },
      postProcesses: [],
    };
    this.context = {
      level: null,
      isWritingModel: false,
      isWritingTypes: false,
    };
  }

  /**
   * Start build the document by option path
   * @method build
   */
  build() {
    orgmode.makelist(this.options.path, this.onnodes.bind(this));
  }

  /**
   * parse by different nodes
   * @method onnodes
   * @param {Array} nodes - this is a node array
   */
  onnodes(nodes) {
    this.query = new orgmode.OrgQuery(nodes);
    this.parse();
    if (typeof this.options.ondone === 'function') {
      this.options.ondone(this.metadata);
    }
  }

  /**
   * call parse function before starting build
   * @method parse
   */
  parse() {
    this.query.toArray().forEach(this.parseNode.bind(this));
    this.finish();
    this.afterFinish();
  }

  /**
   * @method parseNode
   * @param {Object} node - a node by returned
   */
  parseNode(node) {
    const title = node.headline.toLowerCase();
    const content = node.body;
    switch (title) {
      case 'status of this document':
        this.metadata.status = content.match(/This document is a (\w+) version/i)[1];
        break;
      case 'default values':
        this.metadata.defaults = this.parseContent(content)[0];
        break;
      case 'custom types':
        this.context.level = node.level + 1;
        this.context.isWritingTypes = true;
        break;
      case 'models':
        this.context.level = node.level + 1;
        this.context.isWritingTypes = false;
        this.context.isWritingModel = true;
        break;
      default:
        if (this.context.level !== node.level) {
          if (this.context.level > node.level) {
            if (this.context.isWritingTypes) {
              this.context.isWritingTypes = false;
            }
            if (this.context.isWritingModel) {
              this.context.isWritingModel = false;
            }
          }
        } else {
          const name = node.headline;
          const table = this.parseContent(content)[0];
          if (this.context.isWritingTypes) {
            this.type(name, table);
          } else if (this.context.isWritingModel) {
            this.model(name, table);
          }
        }
    }
  }

  /**
   * @method parseContent
   * @param {String} text - every node has a content to be parsed which contains
   *                        the model and relation definitions.
   */
  parseContent(text) {
    let tables = [];
    let tableStarts = false;
    let tableSource = '';
    let tokenize = line => {
      return line.split('|').filter((token, index) => {
        return token && index !== 0;
      }).map((token) => {
        return token.trim();
      }).join(',') + '\n';
    };
    for (let line of text.split('\n')) {
      line = line.trim();
      let first = line[0];
      let last = line[line.length - 1];
      if (!tableStarts && first === '|' && last === '|') {
        tableStarts = true;
      }
      if (tableStarts) {
        if (/^\|[\-\+]+\|$/.test(line)) {
          continue;
        }
        tableSource += tokenize(line);
        if (first !== '|' || last !== '|') {
          tableStarts = false;
          const list = CSV.parse(tableSource);
          const header = list[0];
          tables.push(
            list.slice(1).map((item) => {
              let ret = {};
              header.forEach((key, index) => {
                // convert the common type to real JavaScript type
                let val = item[index];
                switch (val) {
                  case '-':
                  case 'null':
                    val = null; break;
                  case 'true':
                  case 'yes':
                    val = true; break;
                  case 'false':
                  case 'no':
                    val = false; break;
                }
                ret[key] = val;
              });
              return ret;
            })
          );
          tableSource = '';
        }
      }
    }
    return tables;
  }

  /**
   * This is utility function to convert the name to model name
   * @method getModelName
   */
  getModelName(name) {
    return name.replace(/ /g, '');
  }

  /**
   * This is utility function to convert the name to pluralized name
   * @method getPluralName
   */
  getPluralName(name) {
    return inflection.transform(name, ['pluralize', 'dasherize'])
      .toLowerCase().replace('weflex-', '');
  }

  /**
   * Get type
   * @method getTypeData
   */
  getTypeData(type) {
    let newType = null;
    let isEmbed = false;
    // get & -> isEmbed = true
    if (type[0] === '*') {
      type = type.slice(1);
      isEmbed = true;
    }
    if (JavaScriptTypes.indexOf(type.toLowerCase()) === -1) {
      let m;
      if ((m = type.match(/(hasMany|belongsTo|referencesMany)<(\w+)>/)), 
        (m && m.length === 3)) {
        // hasMany<Type>
        newType = {
          type: 'relation',
          value: {
            relation: m[1],
            type: m[2],
          }
        };
      } else if ((m = type.match(/(\w+)\[\]/i)), (m && m.length === 2)) {
        // match type[]
        newType = {
          type: 'array',
          value: m[1],
          isEmbed
        };
      } else if ((m = type.match(/\{(([\w\']+\??)+)\}/i)), (m && m.length >= 2)) {
        // match {'a'?'b'?'c'}
        newType = {
          type: 'enum',
          value: m[1].split('?').map(t => t.replace(/'/g, '')),
          isEmbed
        };
      } else if ((m = type.match(/\{(\d+)\.{2}(\d+)\}/i)), (m && m.length >= 2)) {
        // match {1..10}
        newType = {
          type: 'range',
          value: [
            parseInt(m[1]), 
            parseInt(m[2])
          ],
          isEmbed
        };
      } else {
        newType = {
          value: type,
          isEmbed
        };
      }
    }
    return newType;
  }

  /**
   * @method type
   * @param {String} id
   * @param {Object} props
   */
  type(id, props) {
    let name = this.getModelName(id);
    let validations = [];
    let properties = props.reduce((props, item) => {
      let type = item.type;
      if (!type) {
        return props;
      }
      let typedata = this.getTypeData(type);
      if (typedata) {
        switch (typedata.type) {
          case 'array': 
            type = [typedata.value]; 
            break;
          case 'range':
            type = 'Number';
            validations.push({
              property: item.attr,
              name: 'validatesRange',
              args: {
                min: typedata.value[0],
                max: typedata.value[1],
              }
            });
            break;
          case 'enum':
            type = 'String';
            validations.push({
              property: item.attr,
              name: 'validatesInclusionOf',
              args: {
                in: typedata.value
              }
            });
            break;
        }
      }
      props[item.attr] = type;
      return props;
    }, {});
    this.metadata.types[name] = {
      name,
      base: 'Model',
      strict: true,
      properties,
      validations
    };
  }

  /**
   * @method model
   * @param {String} id
   * @param {Object} props
   */
  model(id, props) {
    let name = this.getModelName(id);
    let plural = this.getPluralName(id);
    let properties = props;
    let base = 'PersistedModel';
    if (id === 'Weflex User') {
      base = 'User';
    }
    this.metadata.modelConfigs[name] = {
      name,
      plural,
      base,
      strict: true,
      idInjection: true,
      indexes: {},
      options: {
        validateUpsert: true
      },
      properties,
    };
  }

  /**
   * @method finish
   */
  finish() {
    let modelConfigs = this.metadata.modelConfigs;
    for (let name in modelConfigs) {
      let model = this.metadata.models[name] = Object.assign({}, modelConfigs[name]);
      let props = model.properties;
      let validations = [];
      let relations = {};
      let acls = [];
      // parse properties
      model.properties = props.reduce((newProps, item) => {
        let type = item.type;
        let attr = item.attr;
        let relationType;
        let isRelation = false;

        const typedata = this.getTypeData(type);
        if (typedata) {
          switch (typedata.type) {
            case 'array':
              type = typedata.value;
              isRelation = modelConfigs[type] || this.metadata.builtins[type];
              relationType = 'referencesMany';
              break;
            case 'relation':
              type = typedata.value.type;
              isRelation = true;
              relationType = typedata.value.relation;
              break;
            default:
              relationType = 'belongsTo';
              isRelation = modelConfigs[type] || this.metadata.builtins[type];
          }
        }
        if (isRelation) {
          let fk;
          switch (relationType) {
            case 'hasMany':
              fk = (() => {
                const targetModelConfig = this.metadata.modelConfigs[type];
                if (targetModelConfig && targetModelConfig.properties) {
                  const targetProp = _.find(targetModelConfig.properties, {
                    type: model.name
                  });
                  if (targetProp && targetProp.attr && targetProp.type === model.name) {
                    return targetProp.attr + 'Id';
                  }
                }
                if (model.name === 'WeflexUser') {
                  return 'userId';
                } else {
                  return model.name[0].toLowerCase() + model.name.slice(1) + 'Id';
                }
              })();
              relations[attr] = {
                type: 'hasMany',
                model: type,
                foreignKey: fk
              };
              return newProps;
            case 'referencesMany':
              fk = inflection.singularize(attr) + 'Ids';
              relations[attr] = {
                type: 'referencesMany',
                model: type,
                foreignKey: fk,
                options: {
                  validate: true
                }
              };
              break;
            case 'belongsTo':
              fk = attr + 'Id';
              relations[attr] = {
                type: 'belongsTo',
                model: type,
                foreignKey: fk
              };
              // if belongsTo relation checked, should create a hasMany to
              // target model
              this.metadata.postProcesses.push({
                arguments: [item, model],
                handler: 'belongsTo2HasMany',
              });
              break;
          }
          attr = fk;
          type = 'String';
        }
        // Post Processed the type and validations
        if (typedata) {
          switch (typedata.type) {
            case 'array':
              if (!this.metadata.types[typedata.value]) {
                type = ['String'];
              } else {
                type = [typedata.value];
              }
              break;
            case 'range':
              type = 'Number';
              validations.push({
                property: item.attr,
                name: 'validatesRange',
                args: {
                  min: typedata.value[0],
                  max: typedata.value[1],
                }
              });
              break;
            case 'enum':
              type = 'String';
              validations.push({
                property: item.attr,
                name: 'validatesInclusionOf',
                args: {
                  in: typedata.value
                }
              });
              break;
            default:
              if (typedata.isEmbed) {
                type = typedata.value;
              }
              break;
          }
        }
        newProps[attr] = {
          type,
          required: item.required
        };
        // Handle with default and defaultFn values
        if (item.default) {
          if (item.default === '[]') {
            newProps[attr]['default'] = [];
          } else {
            const m = item.default.match(/^\'?(\w+|\[\])\'?$/);
            if (m && (m[0] === m[1])) {
              newProps[attr]['defaultFn'] = m[0];
            } else {
              newProps[attr]['default'] = m && m[1];
            }
          }
        }
        return newProps;
      }, {});
      // update relations
      model.validations = validations;
      model.relations = relations;
      model.acls = acls;
    }
  }

  /**
   * @method afterFinish
   */
  afterFinish() {
    this.metadata.postProcesses.forEach((item) => {
      this[item.handler].apply(this, item.arguments);
    });
  }

  /**
   * @method belongsTo2HasMany
   */
  belongsTo2HasMany(item, model) {
    const targetModel = this.metadata.models[item.type];
    if (targetModel) {
      let name;
      switch (model.name) {
        case 'WeflexUser': name = 'users'; break;
        case 'WeflexUserIdentity': name = 'identities'; break;
        case 'WeflexUserCredential': name = 'credentials'; break;
        case 'ExternalResource': name = 'resources'; break;
        default:
          const pluralizedName = inflection.pluralize(model.name);
          name = pluralizedName[0].toLowerCase() + pluralizedName.slice(1);
          break;
      }
      const relation = {
        type: 'hasMany',
        model: model.name,
        foreignKey: item.attr + 'Id',
      };
      if (!targetModel.relations) {
        targetModel.relations = {};
      }
      let isDuplicatedRelation = false;
      for (let name in targetModel.relations) {
        const targetRelation = targetModel.relations[name];
        if (targetRelation.type === relation.type &&
          targetRelation.model === relation.model &&
          targetRelation.foreignKey === relation.foreignKey) {
          isDuplicatedRelation = true;
          break;
        }
      }
      if (isDuplicatedRelation) {
        return;
      }
      targetModel.relations[name] = relation;
    }
  }
}

exports.PancakeBuilder = PancakeBuilder;
