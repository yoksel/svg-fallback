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

        clean: {
            temp: ["temp"]
        },
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

    grunt.loadTasks('tasks');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('default', ['svg_fallback']);

};