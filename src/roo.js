angular.module('vs.ng-roo', ['ng']).provider('rooConfig', function() {
  'use strict';
  
  var self = this;

  self.$options = {
    auto_compaction: true 
  };

  self.$dwnDbs = [];
  self.$upDbs = [];

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
      },
      getOptions: function(){
        return self.$options;
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

  self.options = function(options){
    if(options){
      self.$options = _.extend(self.$options, options);
    }
  };

});
