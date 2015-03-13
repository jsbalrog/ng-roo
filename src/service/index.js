module.exports = function(ngModule) {
	'use strict';
	
	require('./Pouch.js')(ngModule);
	require('./LocalStorage.js')(ngModule);
};
