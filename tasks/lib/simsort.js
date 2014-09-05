var simsort = {};

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

simsort.sortIconsToGroup = function(icons) {
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
};

module.exports = simsort;