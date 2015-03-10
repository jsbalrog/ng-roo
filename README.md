# ng-roo
ng-roo is an offline storage strategy for angular apps, leveraging PouchDB
(see what we did there?) and CouchDB, and emphasizing local storage as the single
source of truth.

## Prerequisites
* moment.js

## Usage
To use ng-roo, simply include it in your app's list of dependencies.

```
angular.module('MyOfflineApp', ['vs.ng-roo'])
  .config(function(rooConfigProvider) {
	  // Our local database configuration will go here
  });
```

ng-roo operates by having read-only source databases and write-only sink
databases. To configure databases, we have to make rooConfigProvider aware of
our source databases ("down databases") as well as our sink databases ("up databases").

```
angular.module('MyOfflineApp', ['vs.ng-roo'])
  .config(function(rooConfigProvider) {
	  rooConfigProvider.dbs(['myReadOnlyDb1', 'myReadOnlyDb2'], ['myWriteDb']);
  });
```

To use the offline storage ng-roo provides, simply inject the `Pouch` object,
and create a new instance of a database, passing the name of the database as a
string. ng-roo will create the database, if not already created, or it will
pass the already-created database back. You can then call api methods on the
database. ng-roo uses IndexedDB under the covers.

```
angular.module*('MyOfflineApp').service('MyService', function(Pouch) {
  function getDocs() {
		var myDb = new Pouch('myReadOnlyDb1');
		myDb.getAll().then(function(docs) {
		  doSomethingWithDocs(docs);
		});
	}
});
```

Under the covers, ng-pouch syncs data outstanding in the write db(s) with the
retrieved docs in the read dbs to present a consistent data model to the user.
You would most likely use this in conjunction with your own sync service that
would call ng-pouch's sync finished hooks to remove records from the write
database(s).

## Todos
* Bowerify

## License
Licensed under MIT.
