var fs = require('fs');

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    language: grunt.option('lang') || 'en',

    meta: {
      banner: '/*!\n * <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %>\n */\n'
    },

    build_dir: 'dist',

    lib_files: {

      core: [
        'src/PouchDB.js'
      ]
    },

    concat: {
      core: {
        src: ['<%= lib_files.core %>'],
        dest: '<%= build_dir %>/ng-pouch.js'
      }
    },

    ngAnnotate: {
      options: {
        singleQuotes: true
      },
      core: {
        src: '<%= concat.core.dest %>',
        dest: '<%= concat.core.dest %>'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some'
      },
      core: {
        files: {
          '<%= build_dir %>/ng-pouch.min.js': '<%= concat.core.dest %>'
        }
      }
    },
    
    version: {
      options: {
        prefix: 'var version\\s+=\\s+[\'"]'
      },
      defaults: {
        src: ['<%= concat.core.dest %>']
      }
    }
  });

	grunt.registerTask('build', [
    'build-all'
  ]);

	grunt.registerTask('build-all', [
    'build:core'
  ]);

  grunt.registerTask('build:core', [
    'concat:core',
    'version',
    'ngAnnotate:core',
    'uglify:core'
  ]);
};
