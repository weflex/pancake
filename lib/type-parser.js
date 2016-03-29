'use strict';

/**
 * @module pancake.parser
 */

const Parsimmon = require('parsimmon');
const NativeTypes = require('./natives.json');

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

/**
 * parse the string and return a parsed TypeParser object.
 * @method parse
 * @param {String} str - the string to parse
 * @return {Object}
 */
function parse(str) {
  const p = new TypeParser(str);
  return p.parse();
}

/**
 * @class TypeParser
 */
class TypeParser {

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
   * parse instance method
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
        /(hasMany|belongsTo|enum|range|array)/i));
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


module.exports = TypeParser;
TypeParser.parse = function(str) {
  const p = new TypeParser(str);
  return p.parse();
};