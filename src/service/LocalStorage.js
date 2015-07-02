module.exports = function(ngModule) {
	'use strict';
	ngModule.factory('LocalStorageService', function($window, $q) {

		var lsKey = 'ng-roo';
		var localStorage = $window.localStorage;

		function addEntryToLog(userId, db, data) {
			var ns;
			var newItem;
			var items;
			var deferred = $q.defer();
			ns = getLocalStorageNamespace(userId);
			if (ns) {
				newItem = {
					db: '' + db,
					timestamp: new Date(),
					data: data
				};
				items = JSON.parse(localStorage[ns]);
				console.log("Writing new item to log: " + JSON.stringify(newItem));
				items.push(newItem);
				localStorage.setItem(ns, JSON.stringify(items));
				deferred.resolve(items);
			} else {
				deferred.reject('Sorry; HTML5 local storage not supported.');
			}
			return deferred.promise;
		}

		function getLog(userId) {
			var items = [],
				ns = getLocalStorageNamespace(userId),
				deferred = $q.defer();
			if (ns) {
				items = JSON.parse(localStorage[ns]);
				deferred.resolve({
					key: ns,
					items: items
				});
			} else {
				deferred.reject('Sorry; HTML5 local storage not supported.');
			}
			return deferred.promise;
		}

		function clearLog(userId) {
			var retVal = false,
				ns = getLocalStorageNamespace(userId);
			if (ns) {
				localStorage.removeItem(ns);
				retVal = true;
			}

			return retVal;
		}

		function getLocalStorageNamespace(userId) {
			var retVal;
			var fullKey = 'log.' + lsKey + '.' + userId;

			if (localStorage) {
				if (!localStorage[fullKey]) {
					// create a new localstorage namespace
					localStorage[fullKey] = JSON.stringify([]);
				}
				retVal = fullKey;
			}
			return retVal;
		}

		function getItem(key) {
			if (localStorage[key]) {
				return JSON.parse(localStorage[key]);
			} else {
				return localStorage[key];
			}
		}

		function setItem(key, value) {
			if (value) {
				localStorage.setItem(key, JSON.stringify(value));
			}
		}

		function removeItem(key) {
			if(key) {
				localStorage.removeItem(key);
			}
		}

		return {
			addEntryToLog: addEntryToLog,
			getLog: getLog,
			clearLog: clearLog,
			setItem: setItem,
			getItem: getItem,
			removeItem: removeItem
		};
	});
};
