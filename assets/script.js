var doc = document;
var body = doc.querySelector("body");
var result = doc.querySelector("#result");
var svgDefs = doc.querySelector("#svg-defs");
var svgIds = {};

function showSvg () {
    var output = "";
    var symbols = doc.querySelectorAll("symbol");

    if (symbols.length == 0 ) {
        output  = "<span=\"result__error\">There is no symbols.</span>";
        result.innerHTML = output ;
        return;
    }

    for(var i = 0; i< symbols.length; i++){
        var svg_id = symbols[i].getAttribute("id");
        svgIds[svg_id] = svg_id;
    }

     for (var i = 0; i < iconsDataList.length; i++) {
        var item = iconsDataList[i];

        var folder = item["folder"];
        var color = item["color"] ? item["color"] : "none";
        var iconsData = item["iconsData"];

        output  += "<h4>Folder: " + folder +" (" + iconsData.length +")</h4>";
        output  += "Default color: " + color +" <span class=\"color\" style=\"background: " + color +"\"></span>";
        output  += createIconsList(folder, iconsData);
     }

    result.innerHTML += output ;
}

function createIconsList(folder,items) {
    var icons = "";

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var iconId = item.name;
        var width = item.width.replace("px","");
        var height = item.height.replace("px","");
        var fullIconId = folder + "--" +iconId;
        var parentIconId = "";
        var svgClass = folder + " "+ folder +"--" + iconId;
        svgClass += " demo-icon";

        if (svgIds[fullIconId]){
            parentIconId = fullIconId;
        }
        else {
            var splitName = iconId.split("--");
            parentIconId = folder + "--" + splitName[0];
        }

        var svg = "<svg class=\"svg " + svgClass + "\"><use xlink:href=\"#" + parentIconId + "\"></svg>";

        var sizes = "<span class=\"sizes\">" + width +"&times;" + height + "</span>";

        icons += "<li class=\"icons-list__item\">";
        icons += "<h5 class=\"icons-list__title\">#" + fullIconId + " "+ sizes + "</h5>";

        icons += "<span class=\"demo-icon demo-icon--png ie8\">" + svg +"</span>";

        // if (svgIds[fullIconId]){
            icons += "<span class=\"demo-icon demo-icon--svg\">" + svg +"</span>";
        // }

        icons += "</li>";
    }

    icons ="<ul class=\"icons-list\">" + icons + "</ul>";

    return icons;
}

showSvg();