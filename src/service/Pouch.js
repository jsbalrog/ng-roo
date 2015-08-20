/*global window: false, navigator */
module.exports = function (ngModule) {
  'use strict';

  ngModule.service('Pouch', ["$rootScope", "$q", "$http", "rooConfig", "LocalStorageService", function ($rootScope, $q, $http, rooConfig, LocalStorageService) {

    var dbCache = {};

    function getDB(name) {
      if (!dbCache[name]) {
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
      var db = getDB('gemini_cushion_requests'); //JORGE
      return db.query('filter/record_by_table_and_service_no', {startKey: [downDbName, 0], endKey: [downDbName, {}]})
        .then(function (views) {
          var promises = [];
          _.each(views.rows, function(viewDoc) {
            promises.push(db.get(viewDoc.id, {attachments: true}));
          });
          return $q.all(promises);
        })
        .then(function (jorgeView) {
          if (jorgeView.length > 0) {
            _.each(downDocs.rows, function (doc) {
              // If the current write db has any documents, loop through
              // them and see if any of the documents have a change_id that
              // matches the current read-only db
              _.each(jorgeView, function (row) {
                var rowIds = row.change_id.split('::');
                if (rowIds[0] === downDbName) {
                  // Find if any document matches
                  if (doc.id === rowIds[1]) {
                    _.extend(doc.doc, JSON.parse(row.change));

                    // Handle attachments
                    if (row._attachments) {
                      if (doc._attachments) {
                        _.extend(doc._attachments, row._attachments);
                      }
                      else {
                        doc._attachments = row._attachments;
                      }
                    }
                  }
                }
              });
            });
          }
          return downDocs;
        });
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
      var db = getDB('gemini_cushion_requests'); //JORGE
      return db.query('filter/record_by_table_and_service_no', {key: [downDbName, downDoc._id]})
        .then(function (views) {
          var promises = [];
          _.each(views.rows, function(viewDoc) {
            promises.push(db.get(viewDoc.id, {attachments: true}));
          });
          return $q.all(promises);
        })
        .then(function (jorgeView) {
          if (jorgeView.length > 0) {
            // The the current write db has any documents, loop through
            // them and see if any of the documents have a change_id that
            // matches the current read-only db
            _.each(jorgeView, function (doc) {
              _.extend(downDoc, JSON.parse(doc.change));
              // Handle attachments
              if (doc._attachments) {
                if (downDoc._attachments) {
                  _.extend(downDoc._attachments, doc._attachments);
                }
                else {
                  downDoc._attachments = doc._attachments;
                }
              }
            });
          }
          return downDoc;
        });
    }

    return function (db) {

      this.db = db;

      this.query = function (query, options) {
        var self = this;
        var deferred = $q.defer();

        var o = options || {};

        getDB(self.db).query(query, o)
          .then(function (doc) {
            return shimRecord(self.db, doc);
          }).then(function (doc) {
            deferred.resolve(doc);
          }).catch(function (err) {
            deferred.reject(err);
          });
        return deferred.promise;
      };

      /*
      * Used to query design/view secondary indexes
      */
      this.queryView = function(view, key) {
        return getDB(this.db).query(view, key);
      };

      this.getAll = function () {
        var self = this;
        var deferred = $q.defer();
        getDB(self.db).allDocs({
          include_docs: true,
          attachments: true
        }).then(function (docs) {
          return shimRecords(self.db, docs);
        }).then(function (docs) {
          deferred.resolve(_.pluck(docs.rows, 'doc'));
        }).catch(function (err) {
          deferred.reject(err);
        });
        return deferred.promise;
      };

      /**
      * Used to save design/view docs
      * Update existing docs
      */
      this.putDoc = function (doc) {
        return getDB(this.db).put(doc);
      };

      this.get = function (docId) {
        var self = this;
        var deferred = $q.defer();
        getDB(self.db).get(docId, {
          include_docs: true,
          attachments: true
        }).then(function (doc) {
          return shimRecord(self.db, doc);
        }).then(function (doc) {
          deferred.resolve(doc);
        }).catch(function (err) {
          deferred.reject(err);
        });
        return deferred.promise;
      };

      this.destroy = function() {
        var self = this;
        return getDB(self.db).destroy().then(function() {
          // Delete the dbCache for the db
          return delete dbCache[self.db];
        });
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
          }).catch(function (err) {
            deferred.reject(err);
          });
        return deferred.promise;
      };


      this.putEntry = function (originTable, originId, changes, method, endpoint, data, headers, user, attachments, meta) {
        if (endpoint.indexOf('://') === -1) { // check to make sure it's a fully qualified URL
          endpoint = window.location.protocol + '//' + window.location.host + endpoint;
        }
        var id = new moment().toJSON() + '::' + uuid();
        var entry = {
            _id: id,
            change_id: '' + originTable + '::' + originId,
            change: JSON.stringify(changes),
            method: method,
            endpoint: endpoint,
            data: data,
            headers: headers,
            user: user,
            networkType: 'Not supported'
          },
          self = this,
          db = getDB(self.db);

        if (attachments && attachments.length > 0) {
          if (!(attachments instanceof Array)) {
            attachments = [attachments];
          }
          entry._attachments = {};
          var attachmentSize = 0;
          attachments.forEach(function (attachment) {
            attachmentSize += attachment.size;
            entry._attachments[attachment.name] = {
              'content_type': attachment.type,
              'data': attachment
            };
          });
          entry.attachmentSize = attachmentSize;
        }

        if (navigator.connection && navigator.connection.type) {
          entry.networkType = navigator.connection.type;
        }

        return navigator.getBattery()
          .then(function (battery) {
            return {
              charging: battery.charging,
              chargingTime: battery.chargingTime,
              dischargingTime: battery.dischargingTime,
              level: battery.level
            };
          })
          .then(function (batteryInfo) {
            entry.batteryInfo = batteryInfo;
            return getCoords();
          })
          .then(function (coords) {
            if(coords) {
              entry.location = {
                accuracy: coords.accuracy,
                altitude: coords.altitude,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading: coords.heading,
                latitude: coords.latitude,
                longitude: coords.longitude,
                speed: coords.speed
              };
            }
            else {
              entry.location = 'offline';
            }
            return getUserAgent();
          })
          .then(function(userAgent) {
            entry.userAgent = userAgent;
            if(!_.isEmpty(meta)){
              entry.meta = meta;
            }
            return db.put(entry);
          })
          .then(function() {
            return db.info();
          })
          .then(function(info) {
            $rootScope.$emit('jorge-count', info.doc_count);
            return info;
          })
          .catch(function (err) {
            console.log('JORGe error!', err);
            return db.put(entry);
          });

      };

      this.getDocCount = function (query) {
        var self = this;
        var db = getDB(self.db);

        if (query) {
          return db.query(query, {include_docs: false}).then(function (docs) {
            return docs.rows.length;
          });
        }
        else {
          return db.query('filter/record_by_completion')
            .then(function (docs) {
              return docs.rows.length;
            });
        }
      };

      function getUserAgent() {
        var deferred = $q.defer();
        var returnVal = window.navigator.userAgent;
        deferred.resolve(returnVal);
        return deferred.promise;
      }

      function getCoords() {
        var deferred = $q.defer();
        if(navigator.onLine) {
          var timeoutVal = 10 * 1000 * 1000;
          window.navigator.geolocation.getCurrentPosition(
            function (position) {
              deferred.resolve(position.coords);
            },
            function (error) {
              var errors = {
                1: 'Permission denied',
                2: 'Position unavailable',
                3: 'Request timeout'
              };
              deferred.reject('Error: ' + errors[error.code]);
            },
            {enableHighAccuracy: true, timeout: timeoutVal, maximumAge: 1000 * 60 * 5});
        }
        else {
          deferred.resolve(null);
        }
        return deferred.promise;
      }

      //To limit the amount of libraries that we depend on this was copied from
      //stackoverflow, because stackoverflow.
      function uuid(){
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
      }

      this.deleteEntry = function (doc) {
        var self = this;

        if (typeof doc === 'string') {
          return getDB(self.db)
            .get(doc)
            .then(function (doc) {
              return getDB(self.db).remove(doc);
            });
        }
        else {
          return getDB(self.db).remove(doc);
        }
      };

      /**
       * Replicate db with predefined CouchDB
       * @param [strings] docIds - Ids of documents that need to be replicated
       */
      this.replicateIds = function (docIds) {
        var self = this;

        // Initialize the remote and local databases
        var token = 'Bearer ' + window.localStorage['auth-token'];
        var headers = { Authorization: token };
        var remote = new PouchDB(rooConfig.getCouchConfig().couchCushionUrl + self.db, { headers: headers });
        var local = getDB(self.db);
        console.log('Replicating ids', docIds);
        var replicationOptions = {
          doc_ids : docIds
        };

        // Perform replication
        var rep = local.replicate.from(remote, replicationOptions)
          .on('complete', function (result) {
            $rootScope.$emit('ng-roo-replicate-ids-complete', result, self.db, docIds);
            try {
            } catch (error) {
              console.log(error);
            }
          })
          .on('paused', function () {
            $rootScope.$emit('ng-roo-replicate-ids-paused');
            rep.cancel();
          })
          .on('denied', function (err) {
            $rootScope.$emit('ng-roo-replicate-ids-denied', err);
            rep.cancel();
          });
      };

      /**
       * Replicate db with predefined CouchDB
       * @param {object} user - Any User object to be passed into getParams.
       * @param {object} options - functions to determine params and filters.
       */
      this.replicateDB = function (user, opts) {
        var self = this;

        if (rooConfig.getOptions().destroyOnSync) {
          console.log('removing table', self.db);
          return self.destroy()
            .then(function () {
              return self.performReplication(user, opts);
            });
        }
        else {
          return self.performReplication(user, opts);
        }
      };

      this.performReplication = function (user, opts) {
        var self = this;

        // Initialize the remote and local databases
        var token = 'Bearer ' + window.localStorage['auth-token'];
        var headers = {
          Authorization: token
        };
        var remote = new PouchDB(rooConfig.getCouchConfig().couchCushionUrl + self.db, { headers: headers });
        var local = getDB(self.db);
        console.log('Replicating', self.db);
        var replicationOptions = _.extend({
          batch_size: 5
        }, opts);

        if (opts.getParams) {
          replicationOptions.query_params = opts.getParams(user);
        }

        // Perform replication
        var rep = local.replicate.from(remote, replicationOptions)
          .on('complete', function (result) {
            $rootScope.$emit('ng-roo-replicate-complete', result, self.db);
            try {
              // Make an entry in the logs
              LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
            } catch (error) {
              console.log(error);
            }
          })
          .on('paused', function () {
            $rootScope.$emit('ng-roo-replicate-paused');
            rep.cancel();
          })
          .on('error', function (err) {
            $rootScope.$emit('ng-roo-replicate-error', err, self.db);
            rep.cancel();
          })
          .on('denied', function (err) {
            $rootScope.$emit('ng-roo-replicate-denied', err);
            rep.cancel();
          });
        rooConfig.getReplications[self.db] = rep;
      };

      this.performSync = function (user, opts) {
        var self = this;

        console.log('Syncing', self.db);
        var syncOptions = _.extend({
          batch_size: 5,
          live: true,
          retry: true
        }, opts);

        if (opts.getParams) {
          syncOptions.query_params = opts.getParams(user);
        }

        // Perform sync
        var token = 'Bearer ' + window.localStorage['auth-token'];
        var headers = {
          Authorization: token
        };
        var remote = new PouchDB(rooConfig.getCouchConfig().couchJorgeUrl + self.db, { ajax: {headers: headers, timeout: 60000} });
        var local = getDB(self.db);
        var sync = local.replicate.to(remote, syncOptions)
          .on('complete', function (result) {
            $rootScope.$emit('ng-roo-sync-complete', result, self.db);
            try {
              // Make an entry in the logs
              LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
            } catch (error) {
              console.log(error);
            }
          })
          .on('change', function (info) {
            $rootScope.$emit('ng-roo-sync-change', info, self.db);
          })
          .on('error', function (err) {
            $rootScope.$emit('ng-roo-sync-error', err, self.db);
          })
          .on('active', function () {
            $rootScope.$emit('ng-roo-sync-active', self.db);
          })
          .on('paused', function () {
            $rootScope.$emit('ng-roo-sync-paused', self.db);
          })
          .on('denied', function (err) {
            $rootScope.$emit('ng-roo-sync-denied', err, self.db);
          });
        rooConfig.getReplications[self.db] = sync;
      };

      this.update = function (updatedDoc) {
        var self = this;
        var deferred = $q.defer();
        var cushiondb = getDB(self.db);
        cushiondb.put(updatedDoc).then(function success(result) {
          deferred.resolve(result);
        }, function error(err) {
          deferred.reject(err);
        });
        return deferred.promise;
      };

      this.writeLogEntries = function (db, user) {
        console.log('Writing log entries for db ' + db + ' for user ' + user.displayName);
        var deferred = $q.defer();
        var promises = [];
        // Do some stuff here.
        getDB(db).allDocs({
          include_docs: true
        }).then(function (docs) {
          // Make an entry in the logs
          _.forEach(docs.rows, function (row) {
            promises.push(LocalStorageService.addEntryToLog(user.employeeID, db, row));
          });

          $q.all(promises).then(function (result) {
            deferred.resolve(result);
          }).catch(function (err) {
            deferred.reject(err);
          });
        });
        return deferred.promise;
      };
    };

  }]);
};
