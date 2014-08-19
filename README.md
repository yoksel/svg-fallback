# svg_fallback

>

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

### Options

#### options.algorithm
Type: `String`
Default value: `binary-tree`

#### options.padding
Type: `String`
Default value: `10`

List of options is here: https://www.npmjs.org/package/spritesmith

#### options.src
Type: `String`

Folder with folders containing icons. Folder name is used as a prefix for icons and name for sprites and stylesheets.

#### options.dest
Type: `String`

Folder for created content.

### Usage Examples

#### Default Options
In this example, the default options are used to do something with whatever. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result would be `Testing, 1 2 3.`

```js
grunt.initConfig({
  svg_fallback: {
        options: {
            algorithm: 'binary-tree',
            padding: 10
        },
        your_target: {
            src: 'sources/**/*.svg',
            dest: 'result/'
        }
    }
});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
