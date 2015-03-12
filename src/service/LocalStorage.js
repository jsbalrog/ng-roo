angular.module('vs.ng-roo').factory('LocalStorageService', function($window, $q) {
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
    addEntryToLog: addEntryToLog
  };
});