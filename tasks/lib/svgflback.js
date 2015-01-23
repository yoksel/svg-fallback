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
    var output = input.replace(new RegExp('([\r\n\t]|\s{2,})', 'g'), '');

    output = output.replace(new RegExp('(<)(.*?)(xml |dtd)(.*?)(>)', 'g'), '');

    output = output.replace(new RegExp('(<g></g>)', 'g'), '');
    output = output.replace(new RegExp('(<defs></defs>)', 'g'), '');

    output = output.replace(new RegExp('((<!--)(.*?)(-->))', 'g'), '');
    output = output.replace(new RegExp('(<title>(.*?)</title>)', 'g'), '');
    output = output.replace(new RegExp('(<desc>(.*?)</desc>)', 'g'), '');

    output = output.replace(new RegExp('( sketch:type="(.*?)")', 'g'), '');
    output = output.replace(new RegExp('( id="(.*?)")', 'g'), '');

    return output;
}

/**
 * @param {string} input - innards of SVG-file
 * @returns {string} innards with closed tags
 */
function closeTags(input) {
    var output = input;
    var unclosedTail = "/>";

    var search = input.match(new RegExp('(<)(.*?)(' + unclosedTail + ')', 'g'));

    if ( search ){
        var tagMatch = input.match(new RegExp('<[a-z]{1,}', 'g'));
        var tag = tagMatch[tagMatch.length - 1];

        tag = tag.replace(new RegExp('<', 'g'), '');

        if ( tag ) {
            var closedTail = '></' + tag + '>';

            output = output.replace(new RegExp(unclosedTail, 'g'), closedTail);
        }
    }

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
 * @param {Object} oldObject - initial object
 * @returns {Object} newObject - copy of initial object
 */
function copyObject(oldObject) {
    var newObject = {};

    for (var key in oldObject) {
        newObject[key] = oldObject[key];
    }

    return newObject;
}

/**
 * @param {Object} defSizesConfig - config with default settings for files
 * @param {string} folderName
 */
function fillConfigFromDefaults(defSizesConfig, folderName) {
    if (defSizesConfig) {
        for (var key in defSizesConfig) {
            var fileConfig = defSizesConfig[key];
            if (!svgflback.configByFileName[folderName]) {
                svgflback.configByFileName[folderName] = {};
            }
            svgflback.configByFileName[folderName][key] = fileConfig;
        }
    }
}

function handleFileConfig(key, folderName, defSizesConfig, fileConfig){
    fileConfig.forEach(function(configsItem) {
        configsItem = copyObject(configsItem);

        var fileName = key;
        var newName = svgmodify.fileNameModf(key, configsItem);
        if (!svgflback.configByFileName[folderName]) {
            svgflback.configByFileName[folderName] = {};
        }

        // Shape has no initial fill color
        if (!configsItem.color) {

            if (svgflback.config[folderName] && svgflback.config[folderName].color) {
                configsItem.color = svgflback.config[folderName].color;
            }

            if (defSizesConfig && defSizesConfig[fileName] && defSizesConfig[fileName].color) {
                configsItem.color = defSizesConfig[fileName].color;
            }
        }

        svgflback.configByFileName[folderName][newName] = configsItem;
    });
}

/**
 * @param {Object} iconsConfig - config with variations for files
 * @param {string} folderName
 */
function fillConfigFromIcons(iconsConfig, defSizesConfig, folderName) {
    if (iconsConfig) {

        for (var key in iconsConfig) {
            var fileConfig = iconsConfig[key];

            handleFileConfig(key, folderName, defSizesConfig, fileConfig);
        }
    }
}

/**
 * @param {string} configPath - url of files with configs
 */
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
    input = input.replace(new RegExp("(<svg|</svg)(.*?)(>)", 'g'), "");

    input = closeTags(input);

    return input;
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
 * @param {string} params.folder - particular folder to process
 * @param {string} params.configKey - key for particular part of config
 */
svgflback.processFolder = function(params) {

    var inputFolder = params.inputFolder,
        destFolder = params.destFolder,
        configKey = params.configKey,
        colorize = params.colorize === false ? false : true,
        folder = params.folder;

    var folders = [];

    if (folder){
        // Proccess particular folder if it defined in params
        folders[0] = inputFolder + folder;
    }
    else {
        // Proccess all folders
        folders = grunt.file.expand(inputFolder + "*");
    }

    folders.forEach(function(inputFolder) {
        var folderName = path.basename(inputFolder);
        var folderOptionsFile = svgflback.config[folderName];
        var folderOptions = {};

        svgmodify.colorize = true;

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

        if ( color ) {
            changesParams["defaultColor"] = color;
        }

        folderOptions = folderOptionsFile[configKey];

        if ( defaults && variations ) {

                // 1. defaults
                changesParams["inputFolder"] = inputFolder;
                changesParams["outputFolder"] = "temp/";
                changesParams["folderOptions"] = defaults;

                if (configKey == "default-sizes"){
                    svgmodify.colorize = false;
                }
                svgmodify.makeChanges(changesParams);

                // 2. variations
                changesParams["inputFolder"] = "temp/" + folderName;
                changesParams["outputFolder"] = destFolder;
                changesParams["folderOptions"] = variations;
                changesParams["defaultColor"] = "";

                svgmodify.makeChanges(changesParams);

            } else {

                if (defaults) {
                    folderOptions = defaults;
                } else if (variations) {
                    folderOptions = variations;
                }

                changesParams["folderOptions"] = folderOptions;
                svgmodify.makeChanges(changesParams);
            }

    }); // end folders.forEach
};

module.exports = svgflback;