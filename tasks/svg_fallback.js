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
    open = require("open");

module.exports = function(grunt) {

    grunt.registerMultiTask('svg_fallback', 'Create PNG from SVG.', function() {

        var currentFolder = __dirname,
            templatesFolder = path.resolve(currentFolder, "../templates"),
            assetsFolder = path.resolve(currentFolder, "../assets"),
            src = this.data.src,
            dest = this.data.dest,
            srcFilesPath = src + "**/*.svg",
            configPath = src + "**/*.json",
            destFolderAbs = process.cwd() + "/" + dest,
            destIndex = dest + "index.html",
            destAssets = dest + "assets/",
            options = this.options(),
            color = options.color,
            debug = options.debug,
            config = {},
            tempFolder = "temp/",
            tempFolderAbs = process.cwd() + "/" + tempFolder,
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

        // Copy files to temp folder,
        // + create files with additional sizes,
        // + create new config for later resizing
        //---------------------------------------

        var newConfig = {};

        var sources = grunt.file.expand(srcFilesPath);

        // 0. Resize Svg-icons if config withs default sizes is exist
        //------------------------------------------
        sources = resizeSvg(sources);

        // 1. Create  SVG library
        //------------------------------------------
        createSvgLib(sources);

        // 2. Copy files
        //------------------------------------------
        sources.forEach(function(filePath) {
            var folder = getFolder(filePath);

            var destPath = svgPreparedFolder + folder + "/" + path.basename(filePath);

            grunt.file.copy(filePath, destPath);
        });

        // 3. Create files with requested sizes in names
        //------------------------------------------
        createFilesWithSizesInNames();

        // 4. Change sizes and colors in SVG-files
        //------------------------------------------

        changePreparedSvg();

        // 5. Convert SVG to PNG
        //------------------------------------------

        var checkSvgs = grunt.file.isDir(svgProcessedFolder);

        if (!checkSvgs) {
            grunt.log.error("SVG-files for converting to PNG not found.");
            return;
        }

        createPngByFoldersAsync();

        // 6. Create sprite from png, write CSS
        //------------------------------------------

        // 7. Create create control page
        //------------------------------------------


        // FUNCTIONS
        //---------------------------------------

        function getFolder(filePath) {
            var pathArray = filePath.split(path.sep);
            return pathArray[pathArray.length - 2];
        }

        /**
         * @param {string} input - code of SVG-file
         * @returns {string} clear svg-code without \n, \r and \t
         */
        function clearInput(input) {
            var output = input.replace(new RegExp("[\r\n\t]", "g"), "");
            // remove xml tad and doctype
            output = output.replace(new RegExp("(<)(.*?)(xml |dtd)(.*?)(>)", 'g'), "");
            output = output.replace(new RegExp("(<g></g>)", 'g'), "");
            return output;
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
            var fileName = folder + "-" + path.basename(from, ".svg");

            input = clearInput(input);
            var symbolHead = getSymbolHead(input, fileName);
            var symbolBody = getSVGBody(input);

            out = symbolHead + symbolBody + symbolTail;

            return out;
        }

        function resizeSvg(sources){
            sources.forEach(function(filePath) {
                var folder = getFolder(filePath);

                var destPath = svgResizedFolder + folder + "/";
                var fileName = path.basename(filePath, ".svg");
                var folderDefaults = config[folder]["default-sizes"];

                if ( folderDefaults != undefined ){
                    var fileDefaults = folderDefaults[fileName];
                    if ( fileDefaults != undefined ){
                        // folder has defaults, file has SIZE
                        fileDefaults["addColor"] = false;
                        changeSVG(grunt.file.read(filePath), filePath, destPath, fileDefaults);
                    }
                    else {
                        // folder has defaults, file no SIZE
                         grunt.file.copy(filePath, destPath + "/" + path.basename(filePath));
                    }
                }
                else {
                    // folder has no defaults
                    grunt.file.copy(filePath, destPath + "/" + path.basename(filePath));
                }
            });

            var newSources = grunt.file.expand(svgResizedFolder + "/**/*.svg");
            return newSources;
        }

        /**
         * Create SVG-symbols and write it to one file
         * @param {Array} sources - list of files
         * @returns {string}
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

        /**
         * 1. Create file with params in name and place it to svgPreparedFolder
         * 2. Create new config during this process
         * @param {string} params - folder,file and properties
         */
        function copyFileWithParam(params) {

            var folder = params["folder"];
            var file = params["file"];
            var props = params["props"];

            var srcPath = svgResizedFolder + folder + "/" + file + ".svg";
            var newName = file;

            for (var key in props) {
                newName += "--" + props[key];
            }

            var destPath = svgPreparedFolder + folder + "/" + newName + ".svg";

            grunt.file.copy(srcPath, destPath);
            if (!newConfig[folder]) {
                newConfig[folder] = {};
            }
            newConfig[folder][newName] = props;
        }

        /**
         * Take SVG and config and create files with needed props in its names
         */
        function createFilesWithSizesInNames() {

            for (var folder in config) {
                var folderOptions = config[folder]["icons"];

                for (var file in folderOptions) {

                    var fileOptions = folderOptions[file];

                    fileOptions.forEach(function(props) {
                        var newFileParams = {
                            "folder": folder,
                            "file": file,
                            "props": props
                        };

                        copyFileWithParam(newFileParams);
                    });
                }
            }

        }

        function changePreparedSvg() {

            var preparedSVG = grunt.file.expand(svgPreparedFolder + "/**/*.svg");

            preparedSVG.forEach(function(filePath) {
                var folder = getFolder(filePath);

                var newPath = svgProcessedFolder + folder + "/";
                changeSVG(grunt.file.read(filePath), filePath, newPath);
            });

        }

        /**
         * @param {Object} attrsObj - old attributes of SVG-element
         * @param {Object} data - new attributes of SVG-element
         * @returns {Object} remapped attributes
         */
        function changeAttrs(attrsObj, data) {

            for (var key in data) {
                var oldWidth, newWidth, oldHeight, newHeight;

                if (key === "width") {
                    oldWidth = parseFloat(attrsObj["width"]);
                    newWidth = parseFloat(data["width"]);
                    oldHeight = parseFloat(attrsObj["height"]);
                    newHeight = newWidth / oldWidth * oldHeight;

                    attrsObj["height"] = newHeight + "px";
                    attrsObj[key] = data[key] + "px";
                } else if (key === "height") {
                    oldHeight = parseFloat(attrsObj["height"]);
                    newHeight = parseFloat(data["height"]);

                    oldWidth = parseFloat(attrsObj["width"]);
                    newWidth = newHeight / oldHeight * oldWidth;

                    attrsObj["width"] = newWidth + "px";
                    attrsObj[key] = data[key] + "px";
                }
            }
            return attrsObj;
        }

        /**
         * @param {string} input - Input SVG
         * @param {string} fileName for getting data from config
         * @returns {string} new tag "svg"
         */
        function rebuildSvgHead(input, newData) {
            var out = "";
            var svgKeys = ["version", "xmlns", "width", "height", "viewBox"];

            var attrsObj = getSVGAttrs(input);

            if (newData) {
                attrsObj = changeAttrs(attrsObj, newData);
            }

            for (var i = 0; i < svgKeys.length; i++) {
                var key = svgKeys[i];
                out += " " + key + "=\"" + attrsObj[key] + "\"";
            }
            out = "<svg" + out + ">";

            return out;
        }

        /**
         * @param {string} input - Input SVG
         * @returns {string} colored svg
         */
        function changeColor(input, newData, folder) {
            var out = input;
            var shapeColor = config[folder].color;

            if (newData && newData.color) {
                shapeColor = newData.color;
            }

            // colorize shapes if we have color
            if (shapeColor) {
                out = "<g fill=\"" + shapeColor + "\">" + out + "</g>";
            }

            return out;
        }

        /**
         * @param {string} input - Input SVG
         * @param {string} from - Input path
         * @param {string} to - Output path
         * @param {Object} config - params to replace in file
         * @returns {string} svg with new sizes and color
         */
        function changeSVG(input, from, to, config) {
            var out = "";
            var svgTail = "</svg>";

            var folder = getFolder(from);

            var fileName = path.basename(from, ".svg");
            var fileNameExt = path.basename(from);

            var newData = config ? config : newConfig[folder][fileName]
            // var newData = newConfig[folder][fileName];

            input = clearInput(input);

            var svgHead = rebuildSvgHead(input, newData);
            var svgBody = getSVGBody(input);
            var addColor = true;
            if( newData != undefined && newData["addColor"] != undefined ){
                addColor = newData["addColor"];
            }
            if ( addColor ){
                svgBody = changeColor(svgBody, newData, folder);
            }

            out = svgHead + svgBody + svgTail;

            grunt.file.write(to + fileNameExt, out);
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
                'algorithm': options.algorithm || 'top-down',
                'padding': options.padding || 0,
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

            if( !debug ){
                rmdir(tempFolder, function() {
                });
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
            return simpleSort(a,b);
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
            iconsData.color = config[folder].color;
            iconsData.icons = [];

            if (iconsData.color) {
                outputCss += mustache.render(prefixFillTemplate, iconsData);
            }

            outputCss += mustache.render(prefixIe8Template, iconsData);

            for (var key in coordinates) {
                var item = coordinates[key];
                var iconTemplate = iconFillTemplate;

                var fileName = path.basename(key, ".png");
                var iconConfig = newConfig[folder][fileName];
                var iconColor = iconConfig ? iconConfig.color : "";

                var iconData = {
                    prefix: iconsData.prefix,
                    name: fileName,
                    width: checkUnits("width", item.width),
                    height: checkUnits("height", item.height),
                    x: checkUnits("x", item.x),
                    y: checkUnits("y", item.y),
                    color: iconColor
                };

                if( !iconData.color ) {
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