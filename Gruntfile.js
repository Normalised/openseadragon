module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    // ----------
    var packageJson = grunt.file.readJSON("package.json"),
        distribution = "build/openseadragon/openseadragon.js",
        minified = "build/openseadragon/openseadragon.min.js",
        packageDirName = "openseadragon-bin-" + packageJson.version,
        packageDir = "build/" + packageDirName + "/",
        releaseRoot = "../site-build/built-openseadragon/",
        sources = [
            "node_modules/q/q.js",
            "src/openseadragon.js",
            /** Later Files have dependencies on these **/
            "src/eventsource.js",
            "src/ui/controldock.js",
            /** Viewer depends on event source / control dock **/
            "src/core/viewer.js",
            "src/ui/fullscreen.js",
            "src/core/tile.js",
            "src/core/drawer.js",
            "src/core/viewport.js",
            "src/input/mousetracker.js",
            "src/input/ViewerMouseTracker.js",
            "src/ui/control.js",
            "src/ui/ViewerControls.js",
            "src/ui/button.js",
            "src/ui/buttongroup.js",
            "src/ui/navigator.js",
            "src/strings.js",
            "src/tilesources/tilesource.js",
            "src/tilesources/dzitilesource.js",
            "src/tilesources/iiiftilesource.js",
            "src/tilesources/iiif1_1tilesource.js",
            "src/tilesources/osmtilesource.js",
            "src/tilesources/tmstilesource.js",
            "src/tilesources/legacytilesource.js",
            "src/tilesources/tilesourcecollection.js",
            "src/tilesources//TileSourceFactory.js",
            "src/geom2d/point.js",
            "src/geom2d/rectangle.js",
            "src/geom2d/displayrectangle.js",
            "src/spring.js",
            "src/ui/overlay.js",
            "src/ui/Renderable.js",
            "src/ui/FullPageView.js",
            "src/renderers/TileCanvasRenderer.js",
            "src/renderers/TileHtmlRenderer.js",
            "src/util/ImageLoader.js"
        ];

    // ----------
    // Project configuration.
    grunt.initConfig({
        pkg: packageJson,
        osdVersion: {
            versionStr: packageJson.version,
            major:      parseInt(packageJson.version.split('.')[0], 10),
            minor:      parseInt(packageJson.version.split('.')[1], 10),
            revision:   parseInt(packageJson.version.split('.')[2], 10)
        },
        clean: {
            build: ["build"],
            package: [packageDir],
            release: {
                src: [releaseRoot],
                options: {
                    force: true
                }
            }
        },
        concat: {
            options: {
                banner: "//! <%= pkg.name %> <%= pkg.version %>\n"
                    + "//! Built on <%= grunt.template.today('yyyy-mm-dd') %>\n"
                    + "//! Git commit: <%= gitInfo %>\n"
                    + "//! http://openseadragon.github.io\n"
                    + "//! License: http://openseadragon.github.io/license/\n\n",
                process: true
            },
            dist: {
                src:  [ "<banner>" ].concat(sources),
                dest: distribution
            }
        },
        replace: {
            cleanPaths: {
                src: ['build/openseadragon/*.map'],
                overwrite: true,
                replacements: [
                    {
                        from: /build\/openseadragon\//g,
                        to: ''
                    }
                ]
            }
        },
        uglify: {
            options: {
                preserveComments: "some",
                sourceMap: function (filename) {
                    return filename.replace(/\.js$/, '.js.map');
                },
                sourceMappingURL: function (filename) {
                    return filename.replace(/\.js$/, '.js.map').replace('build/openseadragon/', '');
                }
            },
            openseadragon: {
                src: [ distribution ],
                dest: minified
            }
        },
        compress: {
            zip: {
                options: {
                    archive: "build/releases/" + packageDirName + ".zip",
                    level: 9
                },
                files: [
                   { expand: true, cwd: "build/", src: [ packageDirName + "/**" ] }
                ]
            },
            tar: {
                options: {
                    archive: "build/releases/" + packageDirName + ".tar.gz",
                    level: 9
                },
                files: [
                   { expand: true, cwd: "build/", src: [ packageDirName + "/**" ] }
                ]
            }
        },
        qunit: {
            all: {
                options: {
                    timeout: 10000,
                    urls: [ "http://localhost:8000/test/test.html" ]
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: 8000,
                    base: "."
                }
            }
        },
        watch: {
            files: [ "Gruntfile.js", "src/**/*.js", "images/*" ],
            tasks: "build"
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                force: true,
                ignores:['node_modules/q/q.js']
            },
            beforeconcat: sources,
            afterconcat: [ distribution ]
        },
        "git-describe": {
            build: {
                options: {
                    prop: "gitInfo"
                }
            }
        }
    });

    // ----------
    // Copy:build task.
    // Copies the image files into the appropriate location in the build folder.
    grunt.registerTask("copy:build", function() {
        grunt.file.recurse("images", function(abspath, rootdir, subdir, filename) {
            grunt.file.copy(abspath, "build/openseadragon/images/" + (subdir || "") + filename);
        });
    });

    // ----------
    // Copy:package task.
    // Creates a directory tree to be compressed into a package.
    grunt.registerTask("copy:package", function() {
        grunt.file.recurse("build/openseadragon", function(abspath, rootdir, subdir, filename) {
            var dest = packageDir
                + (subdir ? subdir + "/" : '/')
                + filename;
            grunt.file.copy(abspath, dest);
        });
        grunt.file.copy("changelog.txt", packageDir + "changelog.txt");
        grunt.file.copy("LICENSE.txt", packageDir + "LICENSE.txt");
    });

    // ----------
    // Copy:release task.
    // Copies the contents of the build folder into the release folder.
    grunt.registerTask("copy:release", function() {
        grunt.file.recurse("build", function(abspath, rootdir, subdir, filename) {
            if (subdir === 'releases') {
                return;
            }

            var dest = releaseRoot
                + (subdir ? subdir + "/" : '/')
                + filename;

            grunt.file.copy(abspath, dest);
        });
    });

    // ----------
    // Build task.
    // Cleans out the build folder and builds the code and images into it, checking lint.
    grunt.registerTask("build", [
        "clean:build", "jshint:beforeconcat", "git-describe", "concat",
        "uglify", "replace:cleanPaths", "copy:build"
    ]);

    // ----------
    // Test task.
    // Builds and runs unit tests.
    grunt.registerTask("test", ["build", "connect", "qunit"]);

    // ----------
    // Package task.
    // Builds and creates the .zip and .tar.gz files.
    grunt.registerTask("package", ["build", "copy:package", "compress", "clean:package"]);

    // ----------
    // Publish task.
    // Cleans the built files out of the release folder and copies newly built ones over.
    grunt.registerTask("publish", ["package", "clean:release", "copy:release"]);

    // ----------
    // Default task.
    // Does a normal build.
    grunt.registerTask("default", ["build"]);
};
