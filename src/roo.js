angular.module('vs.ng-roo', ['ng']).provider('rooConfig', function() {
  var self = this;

  self.$dwnDbs = null;
  self.$upDbs = null;

  this.$get = function() {
    return {
      getDwnDbs: function() {
        return self.$dwnDbs;
      },
      getUpDbs: function() {
        return self.$upDbs;
      },
      getCouchConfig: function() {
        return self.$couchConfig;
      }
    };
  };

  self.dbs = function(dwnDbs, upDbs) {
    if(dwnDbs && dwnDbs.length > 0) {
      self.$dwnDbs = dwnDbs;
    }

    if(upDbs && upDbs.length > 0) {
      self.$upDbs = upDbs;
    }
  };

  self.couchConfig = function(couchConfig) {
    if(couchConfig) {
      self.$couchConfig = couchConfig;
    }
  };

});
