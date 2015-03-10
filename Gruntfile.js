var fs = require('fs');

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('bower.json'),

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
        'src/roo.js',
        'src/service/Pouch.js'
      ]
    },

    jshint: {
      options: {
        eqeqeq: true,
        newcap: false,
        globals: {
          angular: true
        }
      },
      core: {
        files: {
          src: ['<%= lib_files.core %>']
        }
      }
    },

    concat: {
      core: {
        src: ['<%= lib_files.core %>'],
        dest: '<%= build_dir %>/ng-roo.js'
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
          '<%= build_dir %>/ng-roo.min.js': '<%= concat.core.dest %>'
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
    'jshint:core',
    'concat:core',
    'version',
    'ngAnnotate:core',
    'uglify:core'
  ]);
};
