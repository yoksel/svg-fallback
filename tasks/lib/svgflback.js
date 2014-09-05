var path = require("path"),
    svgmodify = require("svg-modify"),
    grunt = require("grunt");

var svgflback = {};

svgflback.config = {};
svgflback.configByFileName = {};

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

function fillConfigFromDefaults(defSizesConfig, folder) {
    if (defSizesConfig) {
        for (var key in defSizesConfig) {
            var fileConfig = defSizesConfig[key];
            if (!svgflback.configByFileName[folder]) {
                svgflback.configByFileName[folder] = {};
            }
            svgflback.configByFileName[folder][key] = fileConfig;
        }
    }
}

function copyObject(obj) {
    var newObject = {};

    for (var key in obj) {
        newObject[key] = obj[key];
    }

    return newObject;
}

function fillConfigFromIcons(iconsConfig, defSizesConfig, folder) {
    if (iconsConfig) {

        for (var key in iconsConfig) {
            var fileConfig = iconsConfig[key];

            fileConfig.forEach(function(configsItem) {
                configsItem = copyObject(configsItem);

                var fileName = key;
                var newName = svgmodify.fileNameModf(key, configsItem);
                if (!svgflback.configByFileName[folder]) {
                    svgflback.configByFileName[folder] = {};
                }

                // Shape has no initial fill color
                if (!configsItem.color) {

                    if (svgflback.config[folder] && svgflback.config[folder].color) {
                        configsItem.color = svgflback.config[folder].color;
                    }

                    if (defSizesConfig && defSizesConfig[fileName] && defSizesConfig[fileName].color) {
                        configsItem.color = defSizesConfig[fileName].color;
                    }
                }


                svgflback.configByFileName[folder][newName] = configsItem;
            });
        }
    }
}

svgflback.prepareConfigs = function(configPath) {

    var configFiles = grunt.file.expand(configPath);

    configFiles.forEach(function(filePath) {
        var folder = getFolder(filePath);
        var configJson = grunt.file.readJSON(filePath);

        // Main config
        svgflback.config[folder] = configJson;

        // Fill config with modified name as a key
        // to get later info about modifcation
        var defSizesConfig = configJson["default-sizes"];
        var iconsConfig = configJson["icons"];

        fillConfigFromDefaults(defSizesConfig, folder);
        fillConfigFromIcons(iconsConfig, defSizesConfig, folder);
    });
};

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
svgflback.createSvgLib = function(sources) {
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
        var destSvgFolder = svgflback.dest + key;
        grunt.file.mkdir(destSvgFolder);

        var destSvg = destSvgFolder + "/" + key + ".svg";
        var symbolsSet = svgSymbols[key];
        var symbolsFile = "<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"display: none;\">" + symbolsSet + "</svg>";
        svgflback.resultSvg.push({
            "name": key,
            "symbols": symbolsFile
        }); // for index file

        grunt.file.write(destSvg, symbolsFile, "utf8");

        // grunt.log.ok(" - " + destSvg);
    }
    grunt.log.writeln("\n");
};

/**
 * Modify and place files to destFolder.
 * If there is no config - just copy files to destFolder.
 * @param {Object} params
 * @param {string} params.inputFolder
 * @param {string} params.destFolder
 * @param {string} params.configKey - key for particular part of config
 */
svgflback.processFolder = function(params) {

    var inputFolder = params.inputFolder,
        destFolder = params.destFolder,
        configKey = params.configKey,
        colorize = params.colorize === false ? false : true;

    var folders = grunt.file.expand(inputFolder + "*");

    folders.forEach(function(inputFolder) {
        var folderName = path.basename(inputFolder);
        var folderOptionsFile = svgflback.config[folderName];
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
            "outputFolder": destFolder,
            "colorize": colorize
        };

        // Has color and has no any configs
        if (color && (!defaults && !variations)) {
            changesParams["defaultColor"] = color;
            svgmodify.makeChanges(changesParams);
            return;
        }

        if (folderOptionsFile[configKey]) {

            var defaults = folderOptionsFile["default-sizes"];

            folderOptions = folderOptionsFile[configKey];
            changesParams = {
                "inputFolder": inputFolder,
                "outputFolder": destFolder,
                "folderOptions": folderOptions,
                "colorize": colorize
            };

            if (configKey != "default-sizes" && color) {
                changesParams["defaultColor"] = color;
            }

            if (configKey != "default-sizes" && defaults) {
                changesParams["defaults"] = defaults;
            }

            svgmodify.makeChanges(changesParams);

        } else {
            copyFiles(inputFolder, destFolder + folderName);
        }
    }); // end folders.forEach
};

module.exports = svgflback;