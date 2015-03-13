angular.module('vs.ng-roo').factory('LocalStorageService', function($window, $q) {
  'use strict';

  var lsKey = 'ng-roo';
  var localStorage = $window.localStorage;

  function addEntryToLog(userId, db, data) {
    var ns;
    var newItem;
    var items;
    var deferred = $q.defer();
    ns = getLocalStorageNamespace(userId);
    if(ns) {
      newItem = {
        db: db,
        timestamp: new Date(),
        data: data
      };
      items = JSON.parse(localStorage[ns]);
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
      deferred.resolve({ key: ns, items: items });
    } else {
      deferred.reject('Sorry; HTML5 local storage not supported.');
    }
    return deferred.promise;
  }

  function clearLog(userId) {
    var retVal = false,
      ns = getLocalStorageNamespace(userId);
    if(ns) {
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

  return {
    addEntryToLog: addEntryToLog,
    getLog: getLog,
    clearLog: clearLog
  };
});
