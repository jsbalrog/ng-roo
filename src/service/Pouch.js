/*global window: false */
module.exports = function(ngModule) {
	'use strict';

	ngModule.service('Pouch', function($rootScope, $q, $http, rooConfig, LocalStorageService) {

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
			var deferred = $q.defer();
			var promises = [];
			var jorgeNames = rooConfig.getUpDbs();
			// Loop through all of the write databases
			_.each(jorgeNames, function(jorgeName) {
				// Get all the documents in the current write db
				getDB(jorgeName).allDocs({
						include_docs: true,
						attachments: true
					})
					.then(function(jorgeDocs) {
						if (jorgeDocs.total_rows > 0) {
							_.each(downDocs.rows, function(doc) {
								// If the current write db has any documents, loop through
								// them and see if any of the documents have a change_id that
								// matches the current read-only db
								_.each(jorgeDocs.rows, function(row) {
									var d = $q.defer();
									var change_id = row.doc.change_id;
									var split = change_id.split('::');
									var dbName = split[0];
									var id = split[1];
									if (dbName === downDbName) {
										// Find if any document matches
										if (doc.id === id) {
											_.extend(doc.doc, JSON.parse(row.doc.change));

											// Handle attachments
											if (row.doc._attachments) {
												if (doc._attachments) {
													_.extend(doc._attachments, row.doc._attachments);
												} else {
													doc._attachments = row.doc._attachments;
												}
											}
										}
									}
									d.resolve(doc);
									promises.push(d.promise);
								});
							});
						}
						$q.all(promises).then(function() {
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
			_.each(jorgeNames, function(jorgeName) {
				// Get all the documents in the current write db
				getDB(jorgeName).allDocs({
					include_docs: true,
					attachments: true
				}).then(function(jorgeDocs) {
					if (jorgeDocs.total_rows > 0) {
						// The the current write db has any documents, loop through
						// them and see if any of the documents have a change_id that
						// matches the current read-only db
						_.each(jorgeDocs.rows, function(row) {
							var change_id = row.doc.change_id;
							var split = change_id.split('::');
							var dbName = split[0];
							var id = split[1];
							if (dbName === downDbName) {
								// Find if any document matches
								if (downDoc._id === id) {
									_.extend(downDoc, JSON.parse(row.doc.change));

									// Handle attachments
									if (row.doc._attachments) {
										if (downDoc._attachments) {
											_.extend(downDoc._attachments, row.doc._attachments);
										} else {
											downDoc._attachments = row.doc._attachments;
										}
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

		function RooObject(db, id) {
			this.$db = db;
			this.$id = id;
		};

		RooObject.prototype.$$update = function(newData) {
			_.extend(this, newData);
			return this;
		};

		var RooArray = function(db) {
			this.$db = db;
			this.$list = [];

			this.$list.$$update = function(newList) {
				updateRooArray(this, newList);
				return this;
			};

			return this.$list;
		};

		function updateRooArray(self, newList) {
			self.length = 0;
			newList.forEach(function(item) {
				self.push(item);
			});
		}

		return function(db) {

			this.db = db;

			this.getAll = function(options) {
				var self = this;
				var deferred = $q.defer();

				var o = _.extend({
					include_docs: true
				}, options);

				getDB(self.db)
					.allDocs(o)
					.then(function(docs) {
						return shimRecords(self.db, docs);
					}).then(function(docs) {
						deferred.resolve(_.pluck(docs.rows, 'doc'));
					}).catch(function(err) {
						deferred.reject(err);
					});

				return deferred.promise;
			};

			this.query = function(query, options) {
				var self = this;
				var deferred = $q.defer();

				var o = options || {};

				getDB(self.db).query(query, o)
					.then(function(doc) {
						return shimRecord(self.db, doc);
					}).then(function(doc) {
						deferred.resolve(doc);
					}).catch(function(err) {
						deferred.reject(err);
					});
				return deferred.promise;
			};

			this.getAll = function() {
				var self = this;
				var deferred = $q.defer();
				getDB(self.db).allDocs({
					include_docs: true,
					attachments: true
				}).then(function(docs) {
					return shimRecords(self.db, docs);
				}).then(function(docs) {
					deferred.resolve(_.pluck(docs.rows, 'doc'));
				}).catch(function(err) {
					deferred.reject(err);
				});
				return deferred.promise;
			};

			this.get = function(docId) {
				var self = this;
				var deferred = $q.defer();
				getDB(self.db).get(docId, {
					include_docs: true,
					attachments: true
				}).then(function(doc) {
					return shimRecord(self.db, doc);
				}).then(function(doc) {
					deferred.resolve(doc);
				}).catch(function(err) {
					deferred.reject(err);
				});
				return deferred.promise;
			};

			this.getAllRoo = function(rooArray) {
				var self = this;
				var r = getListener(self.db, rooArray);
				var deferred = $q.defer();
				getDB(self.db).allDocs({
					include_docs: true
				}).then(function(docs) {
					console.timeEnd('getAllRoo');
					console.time('shim');
					return shimRecords(self.db, docs);
				}).then(function(docs) {
					var data = r.$$update(_.pluck(docs.rows, 'doc'));
					console.timeEnd('shim');
					deferred.resolve(data);
				}).catch(function(err) {
					deferred.reject(err);
				});
				return deferred.promise;
			};

			this.getRoo = function(docId, rooObject) {
				var self = this;
				var r = getListener(self.db, docId, rooObject);

				var deferred = $q.defer();
				getDB(self.db).get(docId, {
					include_docs: true,
					attachments: true
				}).then(function(doc) {
					return shimRecord(self.db, doc);
				}).then(function(doc) {
					deferred.resolve(r.$$update(doc));
				}).catch(function(err) {
					deferred.reject(err);
				});
				return deferred.promise;
			};

			function getListener(db, docId, roo) {
				var r;
				rooConfig.getListeners()[db] = rooConfig.getListeners()[db] || {};
				//First lets check to see if they want an array or an object
				if (typeof docId === 'string') {
					//Now we know they want an object, lets check to see if they passed in a roo.
					if (roo) {
						//They provided us with a roo, so lets just assign it and keep going.
						r = roo;
					} else {
						//No roo was passed in so lets first check our cache for it, if it
						//does not exists in our cache, lets just create a new one.
						r = rooConfig.getListeners()[db][docId] || new RooObject(db, docId);
					}
					//Lets keep the cache up to date
					rooConfig.getListeners()[db][docId] = r;
				} else {
					//We are here because they want an array, lets check if they passed in roo.
					if (roo) {
						//They provided us with a roo, so lets just assign it and keep going.
						r = roo;
					} else {
						//No roo was passed in so lets first check our cache for it, if it
						//does not exists in our cache, lets just create a new one.
						r = rooConfig.getListeners()[db]["$$all"] || new RooArray(db, docId);
					}
					//Lets keep the cache up to date
					rooConfig.getListeners()[db]["$$all"] = r;
				}
				return r;
			}

			/**
			 * Retrieve attachment's local url
			 * @param {string} docId - Document's id were the attachment exists.
			 * @param {string} attrId - The id for the attachment itself.
			 */
			this.getAttachment = function(docId, attrId) {
				var self = this;
				var deferred = $q.defer();
				var URL = window.URL;
				getDB(self.db).getAttachment(docId, attrId)
					.then(function(blob) {
						var url = URL.createObjectURL(blob);
						deferred.resolve(url);
					}).catch(function(err) {
						deferred.reject(err);
					});
				return deferred.promise;
			};

			this.putEntry = function(originTable, originId, changes, method, endpoint, data, headers, user, attachment, id) {
				var entry = {
						_id: new moment().toJSON(),
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
						if (attachment) {
							return db.putAttachment(entry._id, attachment.name, doc.rev, attachment, attachment.type);
						}
					});
			};

			this.deleteEntry = function(doc) {
				var self = this;

				if (typeof doc === 'string') {
					return getDB(self.db)
						.get(doc)
						.then(function(doc) {
							return getDB(self.db).remove(doc);
						})
				} else {
					return getDB(self.db).remove(doc);
				}
			}

			/**
			 * Replicate db with predefined CouchDB
			 * @param {object} user - Any User object to be passed into getParams.
			 * @param {object} options - functions to determine params and filters.
			 */
			this.replicateDB = function(user, opts) {
				var self = this;

				if (rooConfig.getOptions().destoryOnSync) {
					console.log('removing table', self.db);
					return getDB(self.db)
						.destroy()
						.then(function() {
							return self.performReplication(user, opts);
						});
				} else {
					return self.performReplication(user, opts);
				}
			};

			this.performReplication = function(user, opts) {
				var self = this;
				var deferred = $q.defer();

				// Initialize the remote and local databases
				var token = 'Bearer ' + window.localStorage['auth-token'];
				var headers = {
					Authorization: token
				};
				var remote = new PouchDB(rooConfig.getCouchConfig().couchUrl + self.db, {
					headers: headers
				});
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
					.on('complete', function(result) {
						$rootScope.$broadcast('replicating', false, self.db);
						var roos = rooConfig.getListeners()[self.db];
						for (var i in roos) {
							var r = roos[i];
							if (r.$id) {
								self.getRoo(r.$id, r);
							} else {
								self.getAllRoo(r);
							}
						}
						try {
							// Make an entry in the logs
							LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
							deferred.resolve();
						} catch (error) {
							console.log(error);
							deferred.reject(error);
						}
						return deferred.promise;
					})
					.on('paused', function() {
						rep.cancel();
					});
				rooConfig.getListeners[self.db] = rep;
			};

			this.performSync = function(user, opts) {
				var self = this;
				var deferred = $q.defer();

				console.log('Syncing', self.db);
				var syncOptions = _.extend({
					batch_size: 5,
					live: true
				}, opts);

				if (opts.getParams) {
					syncOptions.query_params = opts.getParams(user);
				}

				// Perform replication
				var token = 'Bearer ' + window.localStorage['auth-token'];
				var headers = {
					Authorization: token
				};
				var remote = new PouchDB(rooConfig.getCouchConfig().couchUrl + self.db, {
					headers: headers
				});
				var sync = PouchDB.sync(self.db, remote, syncOptions)
					.on('complete', function(result) {
						console.log('complete');
						try {
							// Make an entry in the logs
							LocalStorageService.addEntryToLog(user.employeeID, self.db, result);
							deferred.resolve();
						} catch (error) {
							console.log(error);
							deferred.reject(error);
						}
						return deferred.promise;
					})
					.on('change', function(info) {
						if (info.direction === 'push') {
							var ids = [];
							info.change.docs.forEach(function(doc) {
								if (!doc._deleted) {
									ids.push(doc._id);
								}
							});
							queueJorgeRequest(ids);
						}
						console.log('info', info);
					})
					.on('error', function(err) {
						console.log('error', err);
					})
					.on('active', function() {
						console.log('active');
					})
					.on('paused', function() {
						console.log('paused');
					});
				rooConfig.getListeners[self.db] = sync;
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

			this.writeLogEntries = function(db, user) {
				console.log('Writing log entries for db ' + db + ' for user ' + user.displayName);
				var deferred = $q.defer();
				var promises = [];
				// Do some stuff here.
				getDB(db).allDocs({
					include_docs: true
				}).then(function(docs) {
					// Make an entry in the logs
					_.forEach(docs.rows, function(row) {
						promises.push(LocalStorageService.addEntryToLog(user.employeeID, db, row));
					});

					$q.all(promises).then(function(result) {
						deferred.resolve(result);
					}).catch(function(err) {
						deferred.reject(err);
					});
				});
				return deferred.promise;
			};


			function queueJorgeRequest(ids) {
				var temp = LocalStorageService.getItem('sqsIds');
				if (temp) {
					ids = ids.concat(_.pluck(temp, 'id'));
				}
				$http.post('/gemini/jorge/queue-processing', {
						ids: ids
					})
					.then(function(resp) {
						LocalStorageService.setItem('sqsIds', resp.data.error)
					})
					.catch(function(err) {
						console.log('POST: [/gemini/jorge/queue-processing] error:' + err);
					});
			}
		};
	});
};
