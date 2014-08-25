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
    svgmodify = require("svg-modify");

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
            config = {},
            tempFolder = "temp/",
            svgResizedFolder = tempFolder + "svgResized/",
            svgPreparedFolder = tempFolder + "svgPrepared/",
            svgProcessedFolder = tempFolder + "svgProcessed/",
            pngFolder = tempFolder + "png/",
            resultSvg = [],
            resultCss = [],
            resultIconsData = [],
            imgOpts = {
                'format': 'png'
            };

        var cb = this.async();

        // Create destinantion folder
        grunt.file.mkdir(dest);

        // Get configs
        //---------------------------------------

        var configFiles = grunt.file.expand(configPath);

        configFiles.forEach(function(filePath) {
            var folder = getFolder(filePath);
            config[folder] = grunt.file.readJSON(filePath);
        });

        // 0. Resize Svg-icons if config with default sizes is exist
        //------------------------------------------

        var resizeParams = {
            "inputFolder": src,
            "destFolder": svgResizedFolder,
            "config": config,
            "configKey": "default-sizes"
        };

        processFolder(resizeParams);

        // 1. Create  SVG library
        //------------------------------------------
        var sources = grunt.file.expand(svgResizedFolder + "**/*.svg");
        createSvgLib(sources);

        // 2. Change sizes and colors in SVG-files (prepare to PNG)
        //------------------------------------------

        var variationsParams = {
            "inputFolder": svgResizedFolder,
            "destFolder": svgProcessedFolder,
            "config": config,
            "configKey": "icons" // variations
        };

        processFolder(variationsParams);

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

        /**
         * @param {string} filePath
         * @returns {string} name of folder containing file
         */
        function getFolder(filePath) {
            var pathArray = filePath.split(path.sep);
            return pathArray[pathArray.length - 2];
        }

        /**
         * @param {string} input - code of SVG-file
         * @returns {string} clear svg-code
         */
        function clearInput(input) {
            var output = input.replace(new RegExp("[\r\n\t]", "g"), "");
            // remove xml tag and doctype
            output = output.replace(new RegExp("(<)(.*?)(xml |dtd)(.*?)(>)", 'g'), "");
            output = output.replace(new RegExp("(<g></g>)", 'g'), "");
            return output;
        }

        /**
         * @param {string} inputFolder
         * @param {string} destFolder
         */
        function copyFiles(inputFolder, destFolder) {

            var sources = grunt.file.expand(inputFolder + "**/*.svg");

            sources.forEach(function(filePath) {
                var folder = getFolder(filePath);

                var destPath = destFolder + "/" + path.basename(filePath);

                grunt.file.copy(filePath, destPath);
            });
        }

        /**
         * Modify and place files to destFolder.
         * If there is no config - just copy files to destFolder.
         * @param {Object} params
         * @param {string} params.inputFolder
         * @param {string} params.destFolder
         * @param {string} params.configKey - key for particular part of config
         */
        function processFolder(params) {

            var inputFolder = params.inputFolder,
                destFolder = params.destFolder,
                configKey = params.configKey;

            var folders = grunt.file.expand(inputFolder + "*");

            folders.forEach(function(inputFolder) {
                var folderName = path.basename(inputFolder);
                var folderOptionsFile = config[folderName];
                var folderOptions = {};


                // No options at all
                if (!folderOptionsFile) {
                    copyFiles(inputFolder, destFolder + folderName);
                    return;
                }

                var defaults = folderOptionsFile["default-sizes"];
                var variations = folderOptionsFile["icons"];
                var color = folderOptionsFile["color"];

                var changesParams = {
                    "inputFolder": inputFolder,
                    "outputFolder": destFolder
                };

                // Has color and has no any configs
                if( color && (!defaults && !variations)){
                    changesParams["defaultColor"] = color;
                    svgmodify.makeChanges(changesParams);
                    return;
                }

                if (folderOptionsFile[configKey]) {

                    folderOptions = folderOptionsFile[configKey];
                    changesParams = {
                        "inputFolder": inputFolder,
                        "outputFolder": destFolder,
                        "folderOptions": folderOptions
                    };
                    if (configKey != "default-sizes" && color) {
                        changesParams["defaultColor"] = color;
                    }
                    svgmodify.makeChanges(changesParams);
                }
                else {
                    copyFiles(inputFolder, destFolder + folderName);
                }
            });
        }

        /**
         * @param {string} input - SVG code
         * @returns {Object} attributes of tag "svg"
         */
        function getSVGAttrs(input) {
            var svgHeadRx = new RegExp("(<svg)(.*?)(>)", 'g');
            var svgOpenTag = svgHeadRx.exec(input)[0];
            svgOpenTag = svgOpenTag.replace(new RegExp("(<svg )|>", 'g'), "");
            var attrsSrc = svgOpenTag.split("\" ");
            var attrsObj = {};

            attrsSrc.forEach(function(attrStr) {
                var attrArray = attrStr.split("=");

                var attrName = attrArray[0];
                var attrVal = attrArray[1];

                attrVal = attrVal.replace(new RegExp("[\"]", 'g'), "");
                attrsObj[attrName] = attrVal;
            });

            return attrsObj;
        }

        /**
         * @param {string} input - SVG-code
         * @returns {string} content of SVG-file without tags "svg"
         */
        function getSVGBody(input) {
            return input.replace(new RegExp("(<svg|</svg)(.*?)(>)", 'g'), "");
        }

        /**
         * @param {string} input - SVG-code
         * @param {string} fileName
         * @returns {string} tag "symbol" with ID and viewBox
         */
        function getSymbolHead(input, fileName) {
            var out = "";
            var attrsObj = getSVGAttrs(input);

            out = "<symbol id=\"" + fileName + "\" viewBox=\"" + attrsObj["viewBox"] + "\">";

            return out;
        }

        /**
         * @param {string} input - SVG-code
         * @param {string} from - filePath
         * @returns {string} tag "symbol" with content
         */
        function createSymbol(input, from) {
            var out = "";
            var symbolTail = "</symbol>";

            var folder = getFolder(from);
            var fileName = folder + "--" + path.basename(from, ".svg");

            input = clearInput(input);
            var symbolHead = getSymbolHead(input, fileName);
            var symbolBody = getSVGBody(input);

            out = symbolHead + symbolBody + symbolTail;

            return out;
        }

        /**
         * Create SVG-symbols and write it to one file
         * @param {Array} sources - list of files
         */
        function createSvgLib(sources) {
            var svgSymbols = {};

            sources.forEach(function(filePath) {

                var folder = getFolder(filePath);

                if (!svgSymbols[folder]) {
                    svgSymbols[folder] = "";
                }

                svgSymbols[folder] += createSymbol(grunt.file.read(filePath), filePath) + "\n";
            });

            grunt.log.writeln("----------------------------------");
            grunt.log.ok("1. Create SVG library...");

            for (var key in svgSymbols) {
                var destSvgFolder = dest + key;
                grunt.file.mkdir(destSvgFolder);

                var destSvg = destSvgFolder + "/" + key + ".svg";
                var symbolsSet = svgSymbols[key];
                var symbolsFile = "<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"display: none;\">" + symbolsSet + "</svg>";
                resultSvg.push({
                    "name": key,
                    "symbols": symbolsFile
                }); // for index file

                grunt.file.write(destSvg, symbolsFile, "utf8");

                // grunt.log.ok(" - " + destSvg);
            }
            grunt.log.writeln("\n");
        }

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

        function convertToVal(iconName) {
            var delimeter = "--";
            var nameArray = iconName.split(delimeter);

            if (nameArray.length === 1) {
                return 1;
            }
            if (nameArray.length === 2) {
                if (isNaN(+nameArray[1])) {
                    return 2;
                } else {
                    return 3;
                }
            }
            return 4;
        }

        function simpleSort(a, b) {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        }

        function sortByName(a, b) {
            a = convertToVal(a.name);
            b = convertToVal(b.name);
            return simpleSort(a, b);
        }

        function sortIconsToGroup(icons) {
            var groupByName = {};
            var resultList = [];
            var delimeter = "--";

            for (var i = 0; i < icons.length; i++) {
                var groupName = icons[i].name.split(delimeter)[0];
                if (!groupByName[groupName]) {
                    groupByName[groupName] = [];
                }
                groupByName[groupName].push(icons[i]);
            }

            for (var key in groupByName) {
                var iconsList = groupByName[key];
                iconsList.sort(sortByName);

                resultList = resultList.concat(iconsList);
            }

            return resultList;
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
            if (config[folder] && config[folder]["color"]) {
                iconsData.color = config[folder]["color"];
            }

            if (iconsData.color) {
                outputCss += mustache.render(prefixFillTemplate, iconsData);
            }

            outputCss += mustache.render(prefixIe8Template, iconsData);

            for (var key in coordinates) {
                var item = coordinates[key];
                var iconTemplate = iconFillTemplate;

                var fileName = path.basename(key, ".png");
                var iconConfig = {};
                var iconColor = iconConfig.color ? iconConfig.color : "";

                var iconData = {
                    prefix: iconsData.prefix,
                    name: fileName,
                    width: checkUnits("width", item.width),
                    height: checkUnits("height", item.height),
                    x: checkUnits("x", item.x),
                    y: checkUnits("y", item.y),
                    color: iconColor
                };

                if (!iconData.color) {
                    iconTemplate = iconNoFillTemplate;
                }

                outputCss += mustache.render(iconTemplate, iconData);

                iconsData.icons.push(iconData);
            }

            iconsData.icons = sortIconsToGroup(iconsData.icons);

            resultIconsData.push({
                "folder": folder,
                "iconsData": iconsData.icons,
                "color": iconsData.color
            });

            fs.writeFileSync(destCssFile, outputCss, 'utf8');

            resultCss.push({
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
                "resultCss": resultCss,
                "resultSvg": resultSvg,
                "iconsDataList": JSON.stringify(resultIconsData)
            };

            var outputIndex = mustache.render(indexTemplate, indexData);
            grunt.file.write(destIndex, outputIndex, "utf8");

            open(destIndex);

            grunt.log.ok("Demo page is ready.");
            grunt.log.writeln("----------------------------------");

        }

    });
};