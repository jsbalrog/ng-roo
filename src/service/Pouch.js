/*global window: false */
module.exports = function(ngModule) {
  'use strict';

  ngModule.service('Pouch', function ($q, rooConfig, LocalStorageService) {

    var dbCache = {};

    function getDB(name) {
      if(!dbCache[name]){
        dbCache[name] = new PouchDB(name, rooConfig.getDbOptions());
      }
      return dbCache[name];
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
                // If the current write db has any documents, loop through
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

    /**
     * Function to update a given read-only record
     * from the server with whatever changes have been
     * made on the client but have not yet been synced
     * to the server, for ui display purposes. This
     * is called currently from the MasterCtrl, so
     * basically on app load. change_id is dbname::id;
     * so, for example, looks something like this:
     * "gemini_cushion_fist::WO-20150226-2949689"
     */
    function shimRecord(downDbName, downDoc) {
      var deferred = $q.defer();
      var jorgeNames = rooConfig.getUpDbs();
      // Loop through all of the write databases
      _.each(jorgeNames, function (jorgeName) {
        // Get all the documents in the current write db
        getDB(jorgeName).allDocs({
          include_docs: true
        }).then(function (jorgeDocs) {
            if (jorgeDocs.total_rows > 0) {
              // The the current write db has any documents, loop through
              // them and see if any of the documents have a change_id that
              // matches the current read-only db
              _.each(jorgeDocs.rows, function (row) {
                var change_id = row.doc.change_id;
                var split = change_id.split('::');
                var dbName = split[0];
                var id = split[1];
                if (dbName === downDbName) {
                  // Find if any document matches
                  if(downDoc._id === id) {
                    _.extend(downDoc, JSON.parse(row.doc.change));

                    // Handle attachments
                    if(row.doc._attachments) {
                      _.extend(downDoc, JSON.parse(row.doc._attachments));
                    }
                  }
                }
              });
            }
            deferred.resolve(downDoc);
          });
        });
      return deferred.promise;
    }

  return function (db) {

    this.db = db;

    this.getAll = function (options) {
      var self = this;
      var deferred = $q.defer();

      var o = _.extend({include_docs: true}, options);

      getDB(self.db)
      .allDocs(o)
      .then(function (docs) {
        return shimRecords(self.db, docs);
      }).then(function (docs) {
        deferred.resolve(_.pluck(docs.rows, 'doc'));
      });

      return deferred.promise;
    };

    this.query = function(query, options){
      var self = this;
      var deferred = $q.defer();

      var o = options || {};

      getDB(self.db).query(query, o)
      .then(function (doc) {
        return shimRecord(self.db, doc);
      }).then(function (doc) {
        deferred.resolve(doc);
      });
      return deferred.promise;
    };

    this.getAll = function () {
      var self = this;
      var deferred = $q.defer();
      getDB(self.db).allDocs({
        include_docs: true
      }).then(function (docs) {
        return shimRecords(self.db, docs);
      }).then(function (docs) {
        deferred.resolve(_.pluck(docs.rows, 'doc'));
      });
      return deferred.promise;
    };

    this.get = function (docId) {
      var self = this;
      var deferred = $q.defer();
      getDB(self.db).get(docId, {
        include_docs: true
      }).then(function (doc) {
        return shimRecord(self.db, doc);
      }).then(function (doc) {
        deferred.resolve(doc);
      });
      return deferred.promise;
    };


      /**
       * Retrieve attachment's local url
       * @param {string} docId - Document's id were the attachment exists.
       * @param {string} attrId - The id for the attachment itself.
       */
      this.getAttachment = function (docId, attrId) {
        var self = this;
        var deferred = $q.defer();
        var URL = window.URL;
        getDB(self.db).getAttachment(docId, attrId)
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          deferred.resolve(url);
        });
        return deferred.promise;
      };

      this.putEntry = function(originTable, originId, changes, method, endpoint, data, headers, user, attachment) {
        var entry = {
            _id: new moment().unix().toString(),
            change_id: '' + originTable + '::' + originId,
            change: JSON.stringify(changes),
            method: method,
            endpoint: endpoint,
            data: data,
            headers: headers,
            user: user
          },
          self = this,
          db = getDB(self.db);

        return db.put(entry)
        .then(function(doc) {
          if(attachment){
            return db.putAttachment(entry._id, attachment.name, doc.rev, attachment, attachment.type);
          }
        });
      };

      /**
       * Replicate db with predefined CouchDB
       * @param {object} user - Any User object to be passed into getParams.
       * @param {object} options - functions to determine params and filters.
       */
      this.replicateDB = function(user, opts) {
        var self = this;

        if(rooConfig.getOptions().destoryOnSync){
            console.log('removing table', self.db);
	          getDB(self.db)
              .destroy()
              .then(function(){
                self.performReplication(user, opts);
              });
	        }else{
            self.performReplication(user, opts);
          }
      };

      this.performReplication = function(user, opts){
          var self = this;
          var deferred = $q.defer();

          // Initialize the remote and local databases
          var remote = new PouchDB(rooConfig.getCouchConfig().couchUrl + '/' + self.db);
          var local = getDB(self.db);
          console.log('Replicating', self.db);
          var replicationOptions = _.extend({batch_size: 5, live: true}, opts);

          if(opts.getParams){
            replicationOptions.query_params = opts.getParams(user);
          }

          // Perform replication
          var rep = local.replicate.from(remote, replicationOptions)
            .on('complete', function (result) {
              try {
                // Make an entry in the logs
                LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
                deferred.resolve();
              } catch(error) {
                console.log(error);
                deferred.reject(error);
              }
              return deferred.promise;
            })
            .on('paused', function(){
              rep.cancel();
            });
        };

      this.performSync = function(user, opts){
        var self = this;
        var deferred = $q.defer();

        console.log('Syncing', self.db);
        var syncOptions = _.extend({batch_size: 5, live: true}, opts);

        if(opts.getParams){
          syncOptions.query_params = opts.getParams(user);
        }

        // Perform replication
        var sync = PouchDB.sync(self.db, rooConfig.getCouchConfig().couchUrl + '/' + self.db, syncOptions)
          .on('complete', function (result) {
            try {
              // Make an entry in the logs
              LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
              deferred.resolve();
            } catch(error) {
              console.log(error);
              deferred.reject(error);
            }
            return deferred.promise;
          })
            .on('paused', function(){
              sync.cancel();
            });
      };

      this.update = function(db, obj, id) {
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

      this.sendJorgeDB = function(db, user) {
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
};
