# svg_fallback

Generates SVG library and PNG+CSS fallback.

> Save your time and enjoy SVG : )

Plugin takes folders with SVG and generates:

1. SVG-library for using with `<use xlink:href="#symbolName"/>`
2. Fallback for IE8: sprite + CSS.

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install svg_fallback --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('svg_fallback');
```

## The "svg_fallback" task

### Overview
In your project's Gruntfile, add a section named `svg_fallback` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  svg_fallback: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

### Required options:

#### your_target.src
Type: `String`

Folder with folders containing icons. Folder name is used as a prefix for icons and name for sprites and stylesheets.

#### your_target.dest
Type: `String`

Folder for created content.

### Optional:

You can redefine options of [spritesmith](https://www.npmjs.org/package/spritesmith), for example:

#### options.algorithm
Type: `String`

Default value: `binary-tree`

#### options.padding
Type: `String`

Default value: `10`

List of spritesmith options is here: [npmjs.org/package/spritesmith](https://www.npmjs.org/package/spritesmith)

### Usage Examples

#### Default:

```js
grunt.initConfig({
  svg_fallback: {
       your_target: {
            src: 'sources/',
            dest: 'result/'
        }
    }
});
```

If you need to redefine options for [spritesmith](https://www.npmjs.org/package/spritesmith), place it to section `options`:

```js
svg_fallback: {
    options: {
        algorithm: 'binary-tree',
        padding: 10
    },
    your_target: {
        src: 'sources/',
        dest: 'result/'
    }
}
```

If you need to test intermediate results, add option `debug`:

```js
svg_fallback: {
    options: {
        debug: true
    },
    your_target: {
        src: 'sources/',
        dest: 'result/'
    }
}

```

and folder **temp** will not be removed.

### Color and resize your icons

It works for transparent svg only.

You can add **config.json** to folder with icons and define preffered changes of initial svg-files.

Example of config:

```js
{
    // default color for all svg-images, OPTIONAL
    "color": "orangered",
    // set list of default sizes if you need to resize initial svg-images, OPTIONAL
    "default-sizes": {
        // set size for particular icon
        "arrow-up": {
            // set width or height
            "width": "182"
            },
        "home": {
            "height": "42"
        }
    },
    // set list of modifications, OPTIONAL.
    // List is used for creating files modificatios before it turns to PNG-sprite
    "icons": {
        "arrow-up": [{
            "width": "50"
        }, {
            "color": "green"
        }, {
            "width": "150",
            "color": "steelblue"
        }],
        "home": [{
            "width": "150"
        }, {
            "width": "170",
            "color": "teal"
        }, {
            "height": "62",
            "color": "yellowgreen"
        }]
    }

}
```

You can use any part of config or not use it at all.

For input, output and config examples feel free to look into **test** folder.

### More information

Input:

```html
souces
  └ myicons
    └ mail.svg
      kitten.svg
```

and output:

```html
result
  └ myicons.css
    myicons.png
    myicons.svg
```

myicons.css:

```css
.myicons {
    fill: orangered;
    }
.ie8 .myicons {
    background-image: url(myicons.png);
    }
.myicons--mail {
    width: 182px;
    height: 262px;
    background-position: -192px 0;
    }
.myicons--mail--green {
    width: 182px;
    height: 262px;
    background-position: 0 0;
    fill: green;
    }
...
```

**Usage of svg**

Add SVG-library to the page and add particular icons this way:

```html
<svg xmlns="http://www.w3.org/2000/svg" class="myicons myicons--mail">
    <use xlink:href="#myicons--mail"/>
</svg>
```


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History

0.1.33 - Fix colorizing SVG in CSS

0.1.32 - Fix colorizing when colors come from defaults

0.1.30 - Change delimiter in names of SVG-symbols: was `-`, now `--` - for consistency with class names

0.1.26 - Move changing SVG functions to module [svg-modify](https://www.npmjs.org/package/svg-modify)

0.1.24 - Fix behavior for folders without config

0.1.20 - Add prefix for sizes to names of files

0.1.16 - Add config for resize SVG-images to default sizes

0.1.15 - Add opening demo page in default browser

0.1.14 - Add icons sizes to demo list

0.1.13 - Add property `fill` to CSS
