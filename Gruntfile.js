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
                debug: true
            },
            your_target: {
                src: 'test/sources/',
                dest: 'test/result/'
            }
        }

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    grunt.registerTask('default', ['svg_fallback']);

};