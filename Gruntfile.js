/*global module:false*/

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
        // Task configuration.
        dirs: {
            src: 'src/',
            build: 'src/build/',
            dest: 'dist/'
        },
        clean: {
            files: ['dist', 'src/build']
        },
        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: true
            },
            dist: {
                files: {
                    '<%= dirs.build %><%= pkg.name %>.js': ['<%= dirs.src %><%= pkg.name %>.js'],
                    '<%= dirs.build %>config.js': '<%= dirs.src %>config.js'
                }
            },
            sourceMap: true
        },
        uglify: {
            options: {
                banner: '<%= banner %>'
            },
            dist: {
                src: '<%= requirejs.compile.options.out %>',
                dest: '<%= dirs.dest %><%= pkg.name %>.min.js'
            }
        },
        jshint: {
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                unused: true,
                boss: true,
                eqnull: true,
                browser: true,
                globals: {}
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            lib_test: {
                src: ['lib/**/*.js', 'test/**/*.js']
            }
        },
        qunit: {
            files: ['test/**/*.html']
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib_test: {
                files: '<%= jshint.lib_test.src %>',
                tasks: ['jshint:lib_test', 'qunit']
            }
        },
        requirejs: {
            compile: {
                //options for wlib
                options: {
                    //almond: true,
                    wrap: false,
                    optimize: "none",
                    baseUrl: '<%= dirs.src %>',
                    //name: '../lib/almond',
                    include: 'wlib',
                    mainConfigFile: '<%= dirs.src %>config.js',
                    out: '<%= dirs.dest %><%= pkg.name %>.js'
                }
                ////options for wlib minimized
                //options: {
                //    //almond: true,
                //    wrap: false,
                //    //optimize: "none",
                //    baseUrl: '<%= dirs.src %>',
                //    //name: '../lib/almond',
                //    include: 'wlib',
                //    mainConfigFile: '<%= dirs.src %>config.js',
                //    out: '<%= dirs.dest %><%= pkg.name %>.min.js'
                //}
                ////options for almond wlib
                //options: {
                //    almond: true,
                //    wrap: false,
                //    optimize: "none",
                //    baseUrl: '<%= dirs.src %>',
                //    name: '../lib/almond',
                //    include: 'config',
                //    mainConfigFile: '<%= dirs.src %>config.js',
                //    out: '<%= dirs.dest %><%= pkg.name %>-pure.js'
                //}
                ////options for almond wlib minimized
                //options: {
                //    almond: true,
                //    wrap: false,
                //    //optimize: "none",
                //    baseUrl: '<%= dirs.src %>',
                //    name: '../lib/almond',
                //    include: 'config',
                //    mainConfigFile: '<%= dirs.src %>config.js',
                //    out: '<%= dirs.dest %><%= pkg.name %>-pure.min.js'
                //}
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-clean');
    //grunt.loadNpmTasks('grunt-contrib-concat');
    //grunt.loadNpmTasks('grunt-contrib-uglify');
    //grunt.loadNpmTasks('grunt-contrib-qunit');
    //grunt.loadNpmTasks('grunt-contrib-jshint');
    //grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-requirejs');

    // Default task.
    // grunt.registerTask('default', ['jshint', 'qunit', 'clean', 'concat', 'requirejs', 'uglify']);
    grunt.registerTask('default', ['requirejs']);

};
