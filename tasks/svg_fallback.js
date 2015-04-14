/*
 * svg_fallback
 *
 *
 * Copyright (c) 2014 yoksel
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path'),
    fs = require('fs'),
    svgToPng = require('svg-to-png'),
    spritesmith = require('spritesmith'),
    mustache = require('mustache'),
    rmdir = require('rimraf'),
    util = require('util'),
    async = require('async'),
    open = require('open'),
    svgmodify = require('svg-modify'),
    svgflback = require('./lib/svgflback'),
    simsort = require('./lib/simsort');

module.exports = function(grunt) {

    grunt.registerMultiTask('svg_fallback', 'Generates SVG library and PNG+CSS fallback.', function() {

        var currentFolder = __dirname,
            templatesFolder = path.resolve(currentFolder, '../templates'),
            assetsFolder = path.resolve(currentFolder, '../assets'),
            src = this.data.src,
            configPath = src + '**/*.json',
            dest = this.data.dest,
            destIndex = dest + 'index.html',
            folder = this.data.folder,
            options = this.options(),
            debug = options.debug,
            svgclass = options.svgclass ? options.svgclass : 'svg',
            svgstyle  = options.svgstyle ? options.svgstyle : '',
            usei8class = options.usei8class ? options.usei8class : false,
            tempFolder = 'temp/',
            svgResizedFolder = tempFolder + 'svgResized/',
            svgPreparedFolder = tempFolder + 'svgPrepared/',
            svgProcessedFolder = tempFolder + 'svgProcessed/',
            pngFolder = tempFolder + 'png/',
            showPngCss = '',
            imgOpts = {
                'format': 'png'
            };

        svgflback.src = this.data.src;
        svgflback.dest = this.data.dest;
        svgflback.resultSvg = [];
        svgflback.resultCss = [];
        svgflback.resultIconsData = [];
        svgflback.resultHtml = '';
        svgflback.closetags = options.closetags === false ? options.closetags : true;
        svgflback.moveStyles = options.movestyles === true ? options.movestyles : false;

        var cb = this.async();

        //dest = folder ? ( dest + folder + "/" ) : dest;

        // Create destinantion folder
        grunt.file.mkdir(dest);

        // Get configs
        //---------------------------------------
        svgflback.prepareConfigs(configPath);

        // 0. Resize Svg-icons if config with default sizes is exist
        //------------------------------------------
        var resizeParams = {
            'inputFolder': src,
            'destFolder': svgResizedFolder,
            'configKey': 'default-sizes',
            'folder': folder,
            'colorize': false
        };

        svgflback.processFolder(resizeParams);

        // 1. Create  SVG library
        //------------------------------------------

        var sources = grunt.file.expand(svgResizedFolder + '**/*.svg');

        svgflback.createSvgLib(sources);

        // 2. Change sizes and colors in SVG-files (prepare to PNG)
        //------------------------------------------

        var variationsParams = {
            'inputFolder': svgResizedFolder,
            'destFolder': svgProcessedFolder,
            'configKey': 'icons' // variations,
        };

        svgflback.processFolder(variationsParams);

        // 3. Convert SVG to PNG
        //------------------------------------------

        var checkSvgs = grunt.file.isDir(svgProcessedFolder);

        if (!checkSvgs) {
            grunt.log.error('SVG-files for converting to PNG not found.');
            return;
        }

        createPngByFoldersAsync();

        // 4. Create sprite from png, write CSS
        //------------------------------------------

        // 5. Create create control page
        //------------------------------------------


        // FUNCTIONS
        //---------------------------------------

        function createPngByFoldersAsync() {

            var svgSrcFolders = fs.readdirSync(svgProcessedFolder);
            async.eachSeries(svgSrcFolders, convertToPng, convertToPngCallback);
        }

        /**
         * @param {string} folderName
         * @param {Function} callback
         */
        function convertToPng(folderName, callback) {

            var srcSvgFolder = svgProcessedFolder + folderName;
            var destPngFolder = pngFolder + folderName;

            svgToPng.convert(srcSvgFolder, destPngFolder) // async, returns promise
            .then(function() {
                callback();
            });
        }

        function convertToPngCallback(err) {
            if (err) {
                grunt.log.errorlns('ERROR.\nA folder failed to process\n\n');
            } else {
                createSpritesByFolders();
            }
        }

        /**
         * Create sprite from PNGs
         */
        function createSpriteAsync(folder, callback) {

            var srcPngFolder = pngFolder + folder;
            var pngFiles = grunt.file.expand(srcPngFolder + '/*.png');

            var destFolder = dest + folder;

            var destSprite = destFolder + '/' + folder + '.png';

            var spritesmithParams = {
                'src': pngFiles,
                'engine': options.engine || 'pixelsmith',
                'algorithm': options.algorithm || 'binary-tree',
                'padding': options.padding || 10,
                'algorithmOpts': options.algorithmOpts || {},
                'engineOpts': options.engineOpts || {},
                'exportOpts': imgOpts || {}
            };

            spritesmith(spritesmithParams, function(err, result) {
                if (err) {
                    callback('FOLDER NOT PROCESSED: ' + srcPngFolder);
                    return;
                }
                //grunt.file.write not working here
                fs.writeFileSync(destSprite, result.image, 'binary');
                writeCss(folder, result.coordinates);
                callback();
            });
        }

        function createSpriteCallback(err) {
            if (err) {
                grunt.log.errorlns('ERROR.\n A folder ' + err + ' failed to process\n\n');
            } else {

                if (!debug) {
                    rmdir(tempFolder, function() {});
                }
                createControlPage();
            }
        }

        /**
         * Create sprites by folder using async
         */
        function createSpritesByFolders() {

            var spriteSrcFolders = fs.readdirSync(pngFolder);

            grunt.log.ok('2. Create PNG-sprite and CSS...');

            async.eachSeries(spriteSrcFolders, createSpriteAsync, createSpriteCallback);
        }

        /**
         * @param {string} key - name of property
         * @param {string} value
         * @returns {string} value with needed units
         */
        function checkUnits(key, val) {
            var units = 'px';
            if (val > 0) {
                if (key === 'width' || key === 'height') {
                    val += 'px';
                } else if (key === 'x' || key === 'y') {
                    val = '-' + val + 'px';
                }
            }
            return val;
        }

        /**
         * @param {string} key - name of file
         * @param {Object} coordinates - info about images in sprite
         * @param {string} folderName
         * @returns {Object} iconData
         */
        function getIconData(key, coordinates, folderName) {
            var config = svgflback.config;
            var configByFileName = svgflback.configByFileName;

            var item = coordinates[key];

            var fileName = path.basename(key, '.png');
            var iconConfig = {};
            var iconColor = '';

            if (configByFileName[folderName] && configByFileName[folderName][fileName] && configByFileName[folderName][fileName]['color']) {
                // first try to take color from configByFileName
                iconColor = configByFileName[folderName][fileName]['color'];
            } else if (config && config[folderName] && config[folderName].color) {
                // second try - find default color in initial config
                iconColor = config[folderName].color;
            }

            var iconData = {
                prefix: folderName,
                name: fileName,
                width: checkUnits('width', item.width),
                height: checkUnits('height', item.height),
                x: checkUnits('x', item.x),
                y: checkUnits('y', item.y),
                color: iconColor
            };

            return iconData;
        }

        /**
         * Write CSS for sprite to file
         * @param {Object} coordinates of created sprite
         */
        function writeCss(folder, coordinates) {

            var outputCss = '',
                filePath = folder + '/' + folder + '.css',
                destCssFile = dest + filePath,
                prefixIe8Template = grunt.file.read(templatesFolder + '/icon--ie8.css'),
                prefixWithFallbackTemplate = grunt.file.read(templatesFolder + '/icon--fallback.css'),
                prefixWithFallbackFillTemplate = grunt.file.read(templatesFolder + '/icon--fallback-fill.css'),
                prefixDemoPngTemplate = grunt.file.read(templatesFolder + '/icon--demopng.css'),
                prefixFillTemplate = grunt.file.read(templatesFolder + '/icon--common-fill.css'),
                iconFillTemplate = grunt.file.read(templatesFolder + '/icon--fill.css'),
                iconNoFillTemplate = grunt.file.read(templatesFolder + '/icon--no-fill.css'),
                iconBgPosTemplate = grunt.file.read(templatesFolder + '/icon--bgpos.css'),
                iconItemTemplate = grunt.file.read(templatesFolder + '/icon--item.html'),
                config = svgflback.config,
                configByFileName = svgflback.configByFileName;

            var iconsData = {};
            iconsData.spriteurl = folder + '.png';
            iconsData.spriteFullUrl = folder + '/' + folder + '.png';
            iconsData.prefix = folder;
            iconsData.icons = [];
            iconsData.color = '';

            if (config[folder] && config[folder]['color']) {
                iconsData.color = config[folder]['color'];
            }

            if (usei8class) {
                if (iconsData.color) {
                    outputCss += mustache.render(prefixFillTemplate, iconsData);
                }
                // Use template with .ie8
                outputCss += mustache.render(prefixIe8Template, iconsData);
            }
            else {
                if (iconsData.color) {
                    prefixWithFallbackTemplate = prefixWithFallbackFillTemplate;
                }
                // Use template with bacground fallback
                outputCss += mustache.render(prefixWithFallbackTemplate, iconsData);
                showPngCss += mustache.render(prefixDemoPngTemplate, iconsData);
            }

            for (var key in coordinates) {
                var iconData = getIconData(key, coordinates, folder);
                var iconTemplate = iconFillTemplate;

                if (!iconData.color) {
                    iconTemplate = iconNoFillTemplate;
                }

                outputCss += mustache.render(iconTemplate, iconData);
                showPngCss += mustache.render(iconBgPosTemplate, iconData);
                svgflback.resultHtml += mustache.render(iconItemTemplate, iconData);
                iconsData.icons.push(iconData);
            }

            for (var i = 0; i < svgflback.resultSvg.length; i++) {
                if (svgflback.resultSvg[i].name == folder && svgflback.resultSvg[i].styles) {
                    outputCss += '\n' + svgflback.resultSvg[i].styles;
                }
            }

            iconsData.icons = simsort.sortIconsToGroup(iconsData.icons);

            svgflback.resultIconsData.push({
                'folder': folder,
                'iconsData': iconsData.icons,
                'color': iconsData.color
            });

            fs.writeFileSync(destCssFile, outputCss, 'utf8');

            svgflback.resultCss.push({
                'url': filePath
            });

        }

        function createIconsGroup(folder, items){
            var icons = '',
                iconSvgTemplate = grunt.file.read(templatesFolder + '/icon--svg.html'),
                iconItemTemplate = grunt.file.read(templatesFolder + '/icon--item.html');

            // Sort icons alphabetically based on their name
            items.sort(function(a, b){
                return a.name.localeCompare(b.name);
            });

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var iconId = item.name;
                var width = item.width.replace('px','');
                var height = item.height.replace('px','');
                var fullIconId = folder + '--' +iconId;
                var parentIconId = '';
                var svgClassFromConfig = svgclass ? svgclass : 'svg';
                var svgStyleFromConfig = svgstyle ? svgstyle : '';

                if (svgStyleFromConfig){
                    svgStyleFromConfig = ' style=\'' + svgStyleFromConfig +'\'';
                }

                var svgElemClass = svgClassFromConfig + ' ' + folder + ' '+ folder +'--' + iconId;

                var splitName = iconId.split('--');
                parentIconId = folder + '--' + splitName[0];

                var svgData = {
                    'svgElemClass': svgElemClass,
                    'parentIconId': parentIconId,
                    'svgStyleFromConfig': svgStyleFromConfig
                    };

                var svg = mustache.render(iconSvgTemplate, svgData);
                var sizes = '<span class=\'sizes\'>' + width +'&times;' + height + '</span>';

                var itemData = {
                    'fullIconId': fullIconId,
                    'svg': svg,
                    'sizes': sizes
                    };

                icons += mustache.render(iconItemTemplate, itemData);
            }

            icons ='<ul class=\'icons-list\'>' + icons + '</ul>';

            return icons;
        }

        function createIconsList() {
            var output = '';

            var iconsDataList = svgflback.resultIconsData;

            for (var i = 0; i < iconsDataList.length; i++) {
                var item = iconsDataList[i];

                var folder = item['folder'];
                var color = item['color'] ? item['color'] : 'none';
                var iconsData = item['iconsData'];

                output += '<h4>Folder: ' + folder +' (' + iconsData.length +')</h4>';
                output += 'Default color: ' + color +' <span class=\'color\' style=\'background: ' + color +'\'></span>';
                output += createIconsGroup(folder, iconsData);
            }
            return output;
        }

        /**
         * Create page with both SVG and PNG Icons
         */
        function createControlPage() {
            var indexTemplate = grunt.file.read(templatesFolder + '/index.html');
            var cssFile = grunt.file.read(assetsFolder + '/style.css');

            if (!usei8class) {
                cssFile += '\n\n/*\n';
                cssFile += 'Additional CSS is needed to check displaying of PNG images';
                cssFile += '\n*/\n\n';
                cssFile += showPngCss;
            }

            svgflback.resultHtml = createIconsList();

            var indexData = {
                'css': cssFile,
                'svgclass': svgclass,
                'svgstyle': svgstyle,
                'resultCss': svgflback.resultCss,
                'resultSvg': svgflback.resultSvg,
                'resultHtml': svgflback.resultHtml,
                'iconsDataList': JSON.stringify(svgflback.resultIconsData)
            };

            var outputIndex = mustache.render(indexTemplate, indexData);
            grunt.file.write(destIndex, outputIndex, 'utf8');

            open(destIndex);

            grunt.log.ok('Demo page is ready.');
            grunt.log.writeln('----------------------------------');

        }

    });
};