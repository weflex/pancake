'use strict';

module.exports = function(Model) {
  Model.observe(
    'before save',
    function(ctx, done) {
      let data = ctx.instance || ctx.data;
      data.modifiedAt = new Date();
      done();
    }
  );
};
