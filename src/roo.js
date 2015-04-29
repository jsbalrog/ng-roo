var ngModule = angular.module('vs.ng-roo', ['ng']);

require('./service')(ngModule);

ngModule.provider('rooConfig', function() {
	'use strict';

	var self = this;

	self.$options = {
		destroyOnSync: true
	};

	self.$dbOptions = {
		auto_compaction: true,
		adapter: 'idb'
	};

	self.$dwnDbs = [];
	self.$upDbs = [];
	self.$listeners = {};

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
			getOptions: function() {
				return self.$options;
			},
			getDbOptions: function() {
				return self.$dbOptions;
			},
			getListeners: function() {
				return self.$listeners;
			},
			clearReplications: function() {
				for (var i in self.$listeners) {
					self.$listeners[i].cancel();
				}
				self.$listeners = {};
			}
		};
	};

	self.dbs = function(dwnDbs, upDbs) {
		if (dwnDbs && dwnDbs.length > 0) {
			self.$dwnDbs = dwnDbs;
		}

		if (upDbs && upDbs.length > 0) {
			self.$upDbs = upDbs;
		}
	};

	self.couchConfig = function(couchConfig) {
		if (couchConfig) {
			self.$couchConfig = couchConfig;
		}
	};

	self.options = function(options) {
		if (options) {
			self.$options = _.extend(self.$options, options);
		}
	};

	self.dbOptions = function(options) {
		if (options) {
			self.$dbOptions = _.extend(self.$dbOptions, options);
		}
	};

});
