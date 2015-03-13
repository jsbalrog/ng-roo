angular.module('vs.ng-roo').service('Pouch', function ($q, rooConfig, LocalStorageService) {
  'use strict';

  function getDB(name) {
    return new PouchDB(name);
  }

  /**
   * Function to update the records that are read-only
   * from the server with whatever changes have been
   * made on the client but have not yet been synced
   * to the server, for ui display purposes. This
   * is called currently from the MasterCtrl, so
   * basically on app load. change_id is dbname::id;
   * so, for example, looks something like this:
   *"gemini_cushion_fist::WO-20150226-2949689"
   */
  function shimRecords(downDbName, downDocs) {
    var deferred = $q.defer();
    var promises = [];
    var jorgeNames = rooConfig.getUpDbs();
    // Loop through all of the write databases
    _.each(jorgeNames, function (jorgeName) {
      // Get all the documents in the current write db
      getDB(jorgeName).allDocs({
        include_docs: true
      })
        .then(function (jorgeDocs) {
          if (jorgeDocs.total_rows > 0) {
            _.each(downDocs.rows, function(doc) {
              // The the current write db has any documents, loop through
              // them and see if any of the documents have a change_id that
              // matches the current read-only db
              _.each(jorgeDocs.rows, function (row) {
                var d = $q.defer();
                var change_id = row.doc.change_id;
                var split = change_id.split('::');
                var dbName = split[0];
                var id = split[1];
                if (dbName === downDbName) {
                  // Find if any document matches
                  if(doc.id === id) {
                    _.extend(doc.doc, JSON.parse(row.doc.change));
                  }
                }
                d.resolve(doc);
                promises.push(d.promise);
              });
            });
          }
          $q.all(promises).then(function () {
            deferred.resolve(downDocs);
          });
        });
    });

    return deferred.promise;
  }

  return function (db) {

    this.db = db;

    this.getAll = function () {
      var self = this;
      var deferred = $q.defer();
      getDB(self.db).allDocs({
        include_docs: true
      }).then(function (docs) {
        return shimRecords(self.db, docs);
      }).then(function (docs) {
        deferred.resolve(docs);
      });
      return deferred.promise;
    };

    this.putEntry = function putEntry(table, id, obj, method, endpoint, data, headers, user, successCb, errorCb) {
      var entry = {
          _id: new moment().unix().toString(),
          change_id: '' + table + '::' + id,
          change: JSON.stringify(obj),
          method: method,
          endpoint: endpoint,
          data: data,
          headers: headers,
          user: user
        },
        self = this;

      getDB(self.db).put(entry).then(successCb, errorCb);
    };

    this.syncDB = function syncDB(name, user, opts) {
      var deferred = $q.defer();
      var remote = new PouchDB(rooConfig.getCouchConfig().couchUrl + '/' + name);
      //var remote = new PouchDB(couchConfig.host + name);
      var local = new PouchDB(name);
      console.log('syncing', name);
      local.replicate.from(remote, {
        filter: opts.filter,
        query_params: opts.getParams(user)
      }).on('complete', function (result) {
        try {
          // Make an entry in the logs
          LocalStorageService.addEntryToLog(user.employeeID, name, result);
          deferred.resolve();
        } catch(error) {
          console.log(error);
          deferred.reject(error);
        }
        return deferred.promise;
      });
    };

    this.update = function update(db, obj, id) {
      var deferred = $q.defer();
      var cushiondb = getDB(db);
      cushiondb.get(id).then(function success(doc) {
        var newDoc = _.extend(doc, obj);
        cushiondb.put(newDoc).then(function success(result) {
          deferred.resolve(result);
        }, function error(result) {
          deferred.reject(result);
        });
      }, function error(result) {
        deferred.reject(result);
      });
      return deferred.promise;
    };

    this.sendJorgeDB = function sendJorgeDB(db, user) {
      console.log('syncing ' + db + ' for user ' + user.displayName);
      var deferred = $q.defer();
      var promises = [];
      // Do some stuff here.
      getDB(db).allDocs({
        include_docs: true
      }).then(function (docs) {
        // Make an entry in the logs
        _.forEach(docs.rows, function(row) {
          promises.push(LocalStorageService.addEntryToLog(user.employeeID, db, row));
        });

        $q.all(promises).then(function(result) {
          deferred.resolve(result);
        });
      });
      return deferred.promise;
    };
  };
});
