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
    util = require("util"),
    async = require("async"),
    open = require("open"),
    svgmodify = require("svg-modify"),
    svgflback = require("./lib/svgflback"),
    simsort = require("./lib/simsort");

module.exports = function(grunt) {

    grunt.registerMultiTask('svg_fallback', 'Generates SVG library and PNG+CSS fallback.', function() {

        var currentFolder = __dirname,
            templatesFolder = path.resolve(currentFolder, "../templates"),
            assetsFolder = path.resolve(currentFolder, "../assets"),
            src = this.data.src,
            dest = this.data.dest,
            configPath = src + "**/*.json",
            destIndex = dest + "index.html",
            options = this.options(),
            debug = options.debug,
            tempFolder = "temp/",
            svgResizedFolder = tempFolder + "svgResized/",
            svgPreparedFolder = tempFolder + "svgPrepared/",
            svgProcessedFolder = tempFolder + "svgProcessed/",
            pngFolder = tempFolder + "png/",
            imgOpts = {
                'format': 'png'
            };

        svgflback.src = this.data.src;
        svgflback.dest = this.data.dest;
        svgflback.resultSvg = [];
        svgflback.resultCss = [];
        svgflback.resultIconsData = [];

        var cb = this.async();

        // Create destinantion folder
        grunt.file.mkdir(dest);

        // Get configs
        //---------------------------------------

        svgflback.prepareConfigs(configPath);

        // 0. Resize Svg-icons if config with default sizes is exist
        //------------------------------------------

        var resizeParams = {
            "inputFolder": src,
            "destFolder": svgResizedFolder,
            "configKey": "default-sizes",
            "colorize": false
        };

        svgflback.processFolder(resizeParams);

        // 1. Create  SVG library
        //------------------------------------------
        var sources = grunt.file.expand(svgResizedFolder + "**/*.svg");
        svgflback.createSvgLib(sources);

        // 2. Change sizes and colors in SVG-files (prepare to PNG)
        //------------------------------------------

        var variationsParams = {
            "inputFolder": svgResizedFolder,
            "destFolder": svgProcessedFolder,
            "configKey": "icons" // variations
        };

        svgflback.processFolder(variationsParams);

        // 3. Convert SVG to PNG
        //------------------------------------------

        var checkSvgs = grunt.file.isDir(svgProcessedFolder);

        if (!checkSvgs) {
            grunt.log.error("SVG-files for converting to PNG not found.");
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

        function convertToPng(folder, callback) {

            var srcSvgFolder = svgProcessedFolder + folder;
            var destPngFolder = pngFolder + folder;

            svgToPng.convert(srcSvgFolder, destPngFolder) // async, returns promise
            .then(function() {
                callback();
            });
        }

        function convertToPngCallback(err) {
            if (err) {
                grunt.log.errorlns('A folder failed to process\n\n');
            } else {
                createSpritesByFolders();
            }
        }

        /**
         * Create sprite from PNGs
         */
        function createSpriteAsync(folder, callback) {

            var srcPngFolder = pngFolder + folder;
            var pngFiles = grunt.file.expand(srcPngFolder + "/*.png");

            var destFolder = dest + folder;

            var destSprite = destFolder + "/" + folder + ".png";

            var spritesmithParams = {
                'src': pngFiles,
                'engine': options.engine || 'auto',
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
                grunt.log.errorlns('A folder failed to process\n\n');
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

            grunt.log.ok("2. Create PNG-sprite and CSS...");

            async.eachSeries(spriteSrcFolders, createSpriteAsync, createSpriteCallback);
        }

        /**
         * @param {string} key - name of property
         * @param {string} value
         * @returns {string} value with needed units
         */
        function checkUnits(key, val) {
            var units = "px";
            if (val > 0) {
                if (key === "width" || key === "height") {
                    val += "px";
                } else if (key === "x" || key === "y") {
                    val = "-" + val + "px";
                }
            }
            return val;
        }

        function getIconData(key, coordinates, folder) {
            var config = svgflback.config;
            var configByFileName = svgflback.configByFileName;

            var item = coordinates[key];

            var fileName = path.basename(key, ".png");
            var iconConfig = {};
            var iconColor = "";

            if (configByFileName[folder] && configByFileName[folder][fileName] && configByFileName[folder][fileName]["color"]) {
                // first try to take color from configByFileName
                iconColor = configByFileName[folder][fileName]["color"];
            } else if (config && config[folder] && config[folder].color) {
                // second try - find default color in initial config
                iconColor = config[folder].color;
            }

            var iconData = {
                prefix: folder,
                name: fileName,
                width: checkUnits("width", item.width),
                height: checkUnits("height", item.height),
                x: checkUnits("x", item.x),
                y: checkUnits("y", item.y),
                color: iconColor
            };

            return iconData;
        }
        /**
         * Write CSS for sprite to file
         * @param {Object} coordinates of created sprite
         */
        function writeCss(folder, coordinates) {

            var outputCss = "";
            var filePath = folder + "/" + folder + ".css";
            var destCssFile = dest + filePath;
            var prefixIe8Template = grunt.file.read(templatesFolder + "/prefix--ie8.css");
            var prefixFillTemplate = grunt.file.read(templatesFolder + "/prefix--fill.css");
            var iconFillTemplate = grunt.file.read(templatesFolder + "/icon--fill.css");
            var iconNoFillTemplate = grunt.file.read(templatesFolder + "/icon--no-fill.css");

            var iconsData = {};
            iconsData.spriteurl = path.basename(dest + folder + "/" + folder + ".png");
            iconsData.prefix = folder;
            iconsData.icons = [];
            iconsData.color = "";
            var config = svgflback.config;
            var configByFileName = svgflback.configByFileName;

            if (config[folder] && config[folder]["color"]) {
                iconsData.color = config[folder]["color"];
            }

            if (iconsData.color) {
                outputCss += mustache.render(prefixFillTemplate, iconsData);
            }

            outputCss += mustache.render(prefixIe8Template, iconsData);

            for (var key in coordinates) {
                var iconData = getIconData(key, coordinates, folder);
                var iconTemplate = iconFillTemplate;

                if (!iconData.color) {
                    iconTemplate = iconNoFillTemplate;
                }

                outputCss += mustache.render(iconTemplate, iconData);
                iconsData.icons.push(iconData);
            }

            iconsData.icons = simsort.sortIconsToGroup(iconsData.icons);

            svgflback.resultIconsData.push({
                "folder": folder,
                "iconsData": iconsData.icons,
                "color": iconsData.color
            });

            fs.writeFileSync(destCssFile, outputCss, 'utf8');

            svgflback.resultCss.push({
                "url": filePath
            });

        }

        /**
         * Create page with both SVG and PNG Icons
         */
        function createControlPage() {
            var indexTemplate = grunt.file.read(templatesFolder + "/index.html");
            var jsFile = grunt.file.read(assetsFolder + "/script.js");
            var cssFile = grunt.file.read(assetsFolder + "/style.css");

            var indexData = {
                "js": jsFile,
                "css": cssFile,
                "resultCss": svgflback.resultCss,
                "resultSvg": svgflback.resultSvg,
                "iconsDataList": JSON.stringify(svgflback.resultIconsData)
            };

            var outputIndex = mustache.render(indexTemplate, indexData);
            grunt.file.write(destIndex, outputIndex, "utf8");

            open(destIndex);

            grunt.log.ok("Demo page is ready.");
            grunt.log.writeln("----------------------------------");

        }

    });
};