/*
 * svg_fallback
 *
 *
 * Copyright (c) 2014 yoksel
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({

    // Configuration to be run (and then tested).
    svg_fallback: {
        options: {
            algorithm: 'binary-tree',
            padding: 10
        },
        your_target: {
            src: 'sources/**/*.svg',
            dest: 'result/'
        }
    },

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // By default, lint and run all tests.
  grunt.registerTask('default', ['svg_fallback']);

};
