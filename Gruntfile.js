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
                // debug: true,
                svgclass: "svgicon",
                // usei8class: true,
                svgstyle: "pointer-events: none; visibility: hidden;",
                // closetags: true // true by default
            },
            your_target: {
                src: 'test/sources/',
                dest: 'test/result/'
            },
            closetag: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'closetag'
            },
            colorize: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'colorize'
            },
            defaultsandcolor: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'defaultsandcolor'
            },
            defaultsonly: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'defaultsonly'
            },
            noconfig: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'noconfig'
            },
            nodefaults: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'nodefaults'
            },
            full: {
                src: 'test/sources/',
                dest: 'test/result/',
                folder: 'fullconfig'
            }
        }

    });

    grunt.loadTasks('tasks');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('default', ['svg_fallback']);

    grunt.registerTask('colorize', ['svg_fallback:colorize']);
    grunt.registerTask('closetag', ['svg_fallback:closetag']);
    grunt.registerTask('defaultsandcolor', ['svg_fallback:defaultsandcolor']);
    grunt.registerTask('defaultsonly', ['svg_fallback:defaultsonly']);
    grunt.registerTask('noconfig', ['svg_fallback:noconfig']);
    grunt.registerTask('nodefaults', ['svg_fallback:nodefaults']);
    grunt.registerTask('full', ['svg_fallback:full']);

};