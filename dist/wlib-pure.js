/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../lib/almond", function(){});

/**
 * wlib核心,其它模块均由此基础进行扩展.
 *
 * @author will.ma
 * @date 2016-02-21
 */
define('wlib-core',[], function () {

    var classType = {
        "[object Array]": "array",
        "[object Boolean]": "boolean",
        "[object Date]": "date",
        "[object Error]": "error",
        "[object Function]": "function",
        "[object Number]": "number",
        "[object Object]": "object",
        "[object RegExp]": "regexp",
        "[object String]": "string"
    };

    function toTypeString(obj) {
        if (obj === null) {
            return "";
        }
        return typeof obj === "object" || typeof obj === "function" ? classType[Object.prototype.toString.call(obj)] || "object" : typeof obj;
    }

    function isArrayLike(obj) {
        var length = "length" in obj && obj.length,
            type = toTypeString(obj);
        if (type === "function" || obj === obj.window) {
            return false;
        }
        if (obj.nodeType === 1 && length) {
            return true;
        }
        return type === "array" || length === 0 || typeof length === "number" && length > 0 && ( length - 1 ) in obj;
    }

    function each(obj, callback, args) {
        var i = 0,
            length = obj.length,
            isArray = isArrayLike(obj);

        if (args) {
            if (isArray) {
                for (; i < length; i++) {
                    if (callback.apply(obj[i], args) === false) {
                        break;
                    }
                }
            } else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        if (callback.apply(obj[i], args) === false) {
                            break;
                        }
                    }
                }
            }
        } else {
            if (isArray) {
                for (; i < length; i++) {
                    if (callback.call(obj[i], i, obj[i]) === false) {
                        break;
                    }
                }
            } else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        if (callback.call(obj[i], i, obj[i]) === false) {
                            break;
                        }
                    }
                }
            }
        }
        return obj;
    }

    var fn = {};
    var wlib = function () {
        return this;
    };
    wlib.prototype = fn;
    var instance = new wlib();

    /**
     * 通过扩展的方式添加内容.
     * @input key+value|object 仅接受两种输入方式,分别为key-value形式和object形式,且key不能为extend.
     */
    fn.extend = function () {

        function merge(key, value) {
            if (toTypeString(key) === "string" && key !== "extend") {
                fn[key] = value;
            }
        }

        if (arguments.length === 2) {
            merge(arguments[0], arguments[1]);
        } else if (arguments.length === 1 && toTypeString(arguments[0]) === "object") {
            each(arguments[0], function (key, value) {
                merge(key, value);
            });
        }
        return instance;
    };

    instance.extend({
        each: each,
        typeof: toTypeString
    });

    return instance;

});

/**
 * wlib主要方法.
 *
 * @author will.ma
 * @date 2016-02-22
 */
define('wlib-funcs',["wlib-core"], function (core) {

    /**
     * clone class.
     *
     * @param object
     * @returns {*}|[]
     */
    function cloneClass(object) {
        if (typeof object === "object") {
            var o;
            if (object.constructor === Object) {
                o = new object.constructor();
            } else {
                o = new object.constructor(object.valueOf());
            }
            for (var key in object) {
                //noinspection JSUnresolvedFunction
                if (object.hasOwnProperty(key) && o[key] !== object[key]) {
                    if (typeof(object[key]) === 'object') {
                        o[key] = clone(object[key]);
                    } else {
                        o[key] = object[key];
                    }
                }
            }
            o.toString = object.toString;
            o.valueOf = object.valueOf;
            return o;
        } else {
            return object;
        }
    }

    /**
     * clone object.
     *
     * @param object
     * @returns {*}|[]
     */
    function clone(object) {
        if (typeof object === 'object') {
            if (object instanceof Array) {
                return merge([], object);
            } else {
                return merge({}, object);
            }
        } else {
            return object;
        }
    }

    /**
     * 将destination和source合并.如果destination的property已存在,则合并里面的内容.
     *
     * @param destination 合并目标
     * @param source 合并内容
     * @param override 是否覆盖,optional,default true
     * @returns {*}|[]
     */
    function merge(destination, source, override) {
        override = override === undefined ? true : !!override;
        if (override) {
            core.each(source, function (name, value) {
                if (destination.hasOwnProperty(name) && typeof destination[name] !== "undefined" && core.typeof(destination[name]) === "object") {
                    destination[name] = merge(destination[name], value, override);
                } else {
                    destination[name] = clone(value);
                }
            });
        } else {
            core.each(source, function (name, value) {
                if (destination.hasOwnProperty(name) && typeof destination[name] !== "undefined") {
                    if (core.typeof(destination[name]) === "object") {
                        destination[name] = merge(destination[name], value, override);
                    }
                } else {
                    destination[name] = clone(value);
                }
            });
        }
        return destination;
    }

    core.extend({
        merge: merge,
        clone: clone,
        cloneClass: cloneClass
    });

    var requestParams;

    function getUrlParam(paramName) {
        if (!requestParams) {
            console.log("parse query");
            requestParams = (function (paramsStr) {
                var params = {};
                var pairs = paramsStr.split("&");
                for (var i = 0; i < pairs.length; i++) {
                    var pos = pairs[i].indexOf('=');
                    if (pos === -1) {
                        continue;
                    }
                    var key = pairs[i].substring(0, pos);
                    var val = decodeURIComponent(pairs[i].substring(pos + 1));
                    if (params.hasOwnProperty(key)) {
                        if (core.typeof(params[key]) === "string") {
                            params[key] = [].concat(params[key], val);
                        } else if (core.typeof(params[key]) === "array") {
                            params[key].push(val);
                        } else {
                            params[key] = val;
                        }
                    } else {
                        params[key] = val;
                    }
                }
                return params;
            })(location.search.substring(1));
        }
        return requestParams[paramName];
    }

    var stringTools = {
        getRegexFirstMatch: function (str, reg) {
            var match = typeof(str) == "string" ? str.match(reg) : [];
            if (match && match.length == 2) {
                return match[1];
            } else {
                return "";
            }
        },
        trim: function (str) {
            return str.replace(/(^\s*)|(\s*$)/g, "");
        },
        ltrim: function (str) {
            return str.replace(/(^\s*)/g, "");
        },
        rtrim: function (str) {
            return str.replace(/(\s*$)/g, "");
        },
        getUrlParam: getUrlParam
    };

    var isDom = (typeof HTMLElement === 'object') ? function (obj) {
        return obj instanceof HTMLElement;
    } : function (obj) {
        return obj && typeof obj === 'object' && obj.nodeType === 1;
    };

    var validateTools = {
        isArray: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        },
        isBoolean: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Boolean]';
        },
        isDate: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Date]';
        },
        isDom: isDom,
        isEmpty: function (obj) {
            if (typeof obj === "undefined" || obj === null) {
                return true;
            }
            switch (core.typeof(obj)) {
                case "array":
                    return obj.length === 0;
                case "number":
                    return obj === 0;
                case "object":
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key) && !validateTools.isEmpty(obj[key])) {
                            return false;
                        }
                    }
                    return true;
                case "string":
                    return stringTools.trim(obj) === "";
                default:
                    return false;
            }
        },
        isError: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Error]';
        },
        isFunction: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Function]';
        },
        isIntegerRegex: function (str) {
            return /^(-?)([0-9]+)$/.test(str);
        },
        isNull: function (obj) {
            return obj === null;
        },
        isNumber: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Number]';
        },
        isNumberRegex: function (str) {
            return /^(-?)([0-9]+)(.([0-9]+))?$/.test(str);
        },
        isObject: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Object]';
        },
        isRegExp: function (obj) {
            return Object.prototype.toString.call(obj) === '[object RegExp]';
        },
        isString: function (obj) {
            return Object.prototype.toString.call(obj) === '[object String]';
        },
        isUndefined: function (obj) {
            return typeof obj === "undefined";
        }
    };

    var timeTools = {
        getSecondOfDay: function (timestamp) {
            var date = timestamp ? new Date(timestamp) : new Date();
            return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
        },
        getMillisecondOfDay: function (timestamp) {
            var date = timestamp ? new Date(timestamp) : new Date();
            return date.getHours() * 3600000 + date.getMinutes() * 60000 + date.getSeconds() * 1000 + date.getMilliseconds();
        },
        getMillisecondUtilNow: function (former) {
            return (new Date()).getTime() - former.getTime();
        },
        getTimeExpressionUtilNow: function (former) {
            var range = timeTools.getMillisecondUtilNow(former);
            if (range < 60000) {
                return Math.floor(range / 1000) + '秒';
            } else if (range < 3600000) {
                return Math.floor(range / 60000) + '分钟';
            } else if (range < 86400000) {
                return Math.floor(range / 3600000) + '小时';
            } else {
                return Math.floor(range / 86400000) + '天';
            }
        },
        getDate: function (date) {
            date = date == undefined ? new Date() : date;
            var year = date.getYear() + 1900;
            var month = date.getMonth() + 1;
            var dayOfMonth = date.getDate();
            return year + '-' + (month < 10 ? '0' : '') + month + '-' + (dayOfMonth < 10 ? '0' : '') + dayOfMonth;
        },
        getTime: function (date) {
            date = date == undefined ? new Date() : date;
            var hour = date.getHours();
            var min = date.getMinutes();
            var sec = date.getSeconds();
            return (hour < 10 ? '0' : '') + hour + ':' + (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
        },
        getDateTime: function (date) {
            date = date == undefined ? new Date() : date;
            return timeTools.getDate(date) + ' ' + timeTools.getTime(date);
        },
        parseDate: function (dateTimeStr) {
            if (dateTimeStr !== undefined && validateTools.isString(dateTimeStr)) {
                var dateTimeArray = [];
                dateTimeStr = stringTools.trim(dateTimeStr);
                if (dateTimeStr.length === 10) {
                    dateTimeArray = dateTimeStr.split('-');
                } else {
                    var tmp = dateTimeStr.split(' ');
                    if (tmp.length == 2) {
                        dateTimeArray = tmp[0].split('-');
                        dateTimeArray = dateTimeArray.concat(tmp[1].split(':'));
                    }
                }
            }
            if (dateTimeArray.length === 3) {
                return new Date(dateTimeArray[0], dateTimeArray[1] - 1, dateTimeArray[2]);
            } else if (dateTimeArray.length === 6) {
                return new Date(dateTimeArray[0], dateTimeArray[1] - 1, dateTimeArray[2], dateTimeArray[3], dateTimeArray[4], dateTimeArray[5]);
            } else {
                return new Date();
            }
        }
    };

    function addComma(value) {
        value = '' + value;
        var pos = 0;
        var valueArray = value.split('.');
        if (valueArray[0] > 0) {
            for (pos = valueArray[0].length - 3; pos > 0; pos -= 3) {
                valueArray[0] = valueArray[0].substr(0, pos) + ',' + valueArray[0].substr(pos);
            }
        } else {
            for (pos = valueArray[0].length - 3; pos > 1; pos -= 3) {
                valueArray[0] = valueArray[0].substr(0, pos) + ',' + valueArray[0].substr(pos);
            }
        }
        return valueArray.join('.');
    }

    var formatTools = {
        formatNumber: function (value, precisionOnK) {
            if (!validateTools.isNumber(value)) {
                return value;
            }
            if (value < 10000 || precisionOnK === undefined) {
                return addComma(value);
            } else {
                var precision = validateTools.isIntegerRegex(precisionOnK) ? parseInt(precisionOnK) : 1;
                var formattedValue = (value / 1000).toFixed(precision) + 'k';
                return addComma(formattedValue);
            }
        },
        formatPercent: function (numerator, denominator, precision) {
            if (!validateTools.isNumber(denominator) || denominator == 0) {
                return 'NaN';
            }
            numerator = validateTools.isNumber(numerator) ? numerator : 0;
            precision = validateTools.isIntegerRegex(precision) ? precision : 0;
            return (100 * numerator / denominator).toFixed(precision) + '%';
        }
    };

    var windowTools = {
        fullScreen: function () {
            var docElm = document.documentElement;
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen();
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen();
            }
        },
        denyIframe: function () {
            if (top.location !== self.location) {
                top.location.href = self.location.href;
            }
        }
    };

    var arrayTools = {
        sort: function (array, property) {
            array.sort(function (o1, o2) {
                var v1 = o1[property];
                var v2 = o2[property];
                if (v2 < v1) {
                    return -1;
                } else if (v2 > v1) {
                    return 1;
                } else {
                    return 0;
                }
            });
            return array;
        }
    };

    core.extend(stringTools);
    core.extend(validateTools);
    core.extend(timeTools);
    core.extend(formatTools);
    core.extend(windowTools);
    core.extend(arrayTools);

});

define('wlib-jsfix',["wlib-core"], function (core) {

    (function (proto) {


        function toISOString() {
            return this.getUTCFullYear() + '-' +
                (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
                this.getUTCDate().toPaddedString(2) + 'T' +
                this.getUTCHours().toPaddedString(2) + ':' +
                this.getUTCMinutes().toPaddedString(2) + ':' +
                this.getUTCSeconds().toPaddedString(2) + 'Z';
        }


        function toJSON() {
            return this.toISOString();
        }

        if (!proto.toISOString) proto.toISOString = toISOString;
        if (!proto.toJSON) proto.toJSON = toJSON;

    })(Date.prototype);

    RegExp.prototype.match = RegExp.prototype.test;

    RegExp.escape = function (str) {
        return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
    };

    String.prototype.startsWith = String.prototype.startsWith || function (pattern, position) {
            position = core.isNumber(position) ? position : 0;
            return this.lastIndexOf(pattern, position) === position;
        };

    String.prototype.endsWith = String.prototype.endsWith || function (pattern, position) {
            pattern = String(pattern);
            position = core.isNumber(position) ? position : this.length;
            if (position < 0) position = 0;
            if (position > this.length) position = this.length;
            var d = position - pattern.length;
            return d >= 0 && this.indexOf(pattern, d) === d;
        };

});
define('wlib-md5',["wlib-core"], function (core) {
    /*
     * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
     * Digest Algorithm, as defined in RFC 1321.
     * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
     * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
     * Distributed under the BSD License
     * See http://pajhome.org.uk/crypt/md5 for more info.
     */

    /*
     * Configurable variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     */
    var hexcase = 0;
    /* hex output format. 0 - lowercase; 1 - uppercase        */
    var b64pad = "";
    /* base-64 pad character. "=" for strict RFC compliance   */
    var chrsz = 8;
    /* bits per input character. 8 - ASCII; 16 - Unicode      */

    /*
     * These are the functions you'll usually want to call
     * They take string arguments and return either hex or base-64 encoded strings
     */
    function hex_md5(s) {
        return binl2hex(core_md5(str2binl(s), s.length * chrsz));
    }

    function b64_md5(s) {
        return binl2b64(core_md5(str2binl(s), s.length * chrsz));
    }

    function str_md5(s) {
        return binl2str(core_md5(str2binl(s), s.length * chrsz));
    }

    function hex_hmac_md5(key, data) {
        return binl2hex(core_hmac_md5(key, data));
    }

    function b64_hmac_md5(key, data) {
        return binl2b64(core_hmac_md5(key, data));
    }

    function str_hmac_md5(key, data) {
        return binl2str(core_hmac_md5(key, data));
    }

    /*
     * Perform a simple self-test to see if the VM is working
     */
    function md5_vm_test() {
        return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
    }

    /*
     * Calculate the MD5 of an array of little-endian words, and a bit length
     */
    function core_md5(x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << ((len) % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var a = 1732584193;
        var b = -271733879;
        var c = -1732584194;
        var d = 271733878;

        for (var i = 0; i < x.length; i += 16) {
            var olda = a;
            var oldb = b;
            var oldc = c;
            var oldd = d;

            a = md5_ff(a, b, c, d, x[i], 7, -680876936);
            d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
            b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
            d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
            b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
            d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
            d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

            a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
            d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
            b = md5_gg(b, c, d, a, x[i], 20, -373897302);
            a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
            d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
            d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
            b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
            d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
            b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
            d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
            b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
            d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
            b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
            d = md5_hh(d, a, b, c, x[i], 11, -358537222);
            c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
            b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
            d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
            b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

            a = md5_ii(a, b, c, d, x[i], 6, -198630844);
            d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
            d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
            d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
            b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
            d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
            b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

            a = safe_add(a, olda);
            b = safe_add(b, oldb);
            c = safe_add(c, oldc);
            d = safe_add(d, oldd);
        }
        return [a, b, c, d];

    }

    /*
     * These functions implement the four basic operations the algorithm uses.
     */
    function md5_cmn(q, a, b, x, s, t) {
        return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
    }

    function md5_ff(a, b, c, d, x, s, t) {
        return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function md5_gg(a, b, c, d, x, s, t) {
        return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function md5_hh(a, b, c, d, x, s, t) {
        return md5_cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function md5_ii(a, b, c, d, x, s, t) {
        return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    /*
     * Calculate the HMAC-MD5, of a key and some data
     */
    function core_hmac_md5(key, data) {
        var bkey = str2binl(key);
        if (bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

        var ipad = new Array(16), opad = new Array(16);
        for (var i = 0; i < 16; i++) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }

        var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
        return core_md5(opad.concat(hash), 512 + 128);
    }

    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
     * Bitwise rotate a 32-bit number to the left.
     */
    function bit_rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
     * Convert a string to an array of little-endian words
     * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
     */
    function str2binl(str) {
        var bin = [];
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < str.length * chrsz; i += chrsz)
            bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
        return bin;
    }

    /*
     * Convert an array of little-endian words to a string
     */
    function binl2str(bin) {
        var str = "";
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < bin.length * 32; i += chrsz)
            str += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask);
        return str;
    }

    /*
     * Convert an array of little-endian words to a hex string.
     */
    function binl2hex(binarray) {
        var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i++) {
            str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
                hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8  )) & 0xF);
        }
        return str;
    }

    /*
     * Convert an array of little-endian words to a base-64 string
     */
    function binl2b64(binarray) {
        var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i += 3) {
            var triplet = (((binarray[i >> 2] >> 8 * ( i % 4)) & 0xFF) << 16)
                | (((binarray[i + 1 >> 2] >> 8 * ((i + 1) % 4)) & 0xFF) << 8 )
                | ((binarray[i + 2 >> 2] >> 8 * ((i + 2) % 4)) & 0xFF);
            for (var j = 0; j < 4; j++) {
                if (i * 8 + j * 6 > binarray.length * 32) str += b64pad;
                else str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
            }
        }
        return str;
    }

    core.extend({
        md5: hex_md5,
        md5base64: b64_md5,
        md5str: str_md5,
        hmacmd5: hex_hmac_md5,
        hmacmd5base64: b64_hmac_md5,
        hmacmd5str: str_hmac_md5
    });

});
define('wlib-base64',["wlib-core"], function (core) {

    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

    function encode(input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        input = _utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output = output +
                _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
                _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
        }
        return output;
    }

    function decode(input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/=]/g, "");
        while (i < input.length) {
            enc1 = _keyStr.indexOf(input.charAt(i++));
            enc2 = _keyStr.indexOf(input.charAt(i++));
            enc3 = _keyStr.indexOf(input.charAt(i++));
            enc4 = _keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = _utf8_decode(output);
        return output;
    }

    function _utf8_encode(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }
        return utftext;
    }

    function _utf8_decode(utftext) {
        var string = "";
        var i = 0;
        var c1 = 0;
        var c2 = 0;
        var c3 = 0;
        while (i < utftext.length) {
            c1 = utftext.charCodeAt(i);
            if (c1 < 128) {
                string += String.fromCharCode(c1);
                i++;
            } else if ((c1 > 191) && (c1 < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }

    core.extend({
        base64encode: encode,
        base64decode: decode
    });
});
define('wlib-sha1',["wlib-core"], function (core) {
    /*
     * Configurable variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     */
    var hexcase = 0;
    /* hex output format. 0 - lowercase; 1 - uppercase */
    var b64pad = "";
    /* base-64 pad character. "=" for strict RFC compliance */
    var chrsz = 8;
    /* bits per input character. 8 - ASCII; 16 - Unicode */

    /*
     * These are the functions you'll usually want to call
     * They take string arguments and return either hex or base-64 encoded strings
     */
    function hex_sha1(s) {
        return binb2hex(core_sha1(str2binb(s), s.length * chrsz));
    }

    function b64_sha1(s) {
        return binb2b64(core_sha1(str2binb(s), s.length * chrsz));
    }

    function str_sha1(s) {
        return binb2str(core_sha1(str2binb(s), s.length * chrsz));
    }

    function hex_hmac_sha1(key, data) {
        return binb2hex(core_hmac_sha1(key, data));
    }

    function b64_hmac_sha1(key, data) {
        return binb2b64(core_hmac_sha1(key, data));
    }

    function str_hmac_sha1(key, data) {
        return binb2str(core_hmac_sha1(key, data));
    }

    /*
     * Perform a simple self-test to see if the VM is working
     */
    function sha1_vm_test() {
        return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
    }

    /*
     * Calculate the SHA-1 of an array of big-endian words, and a bit length
     */
    function core_sha1(x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << (24 - len % 32);
        x[((len + 64 >> 9) << 4) + 15] = len;

        var w = new Array(80);
        var a = 1732584193;
        var b = -271733879;
        var c = -1732584194;
        var d = 271733878;
        var e = -1009589776;

        for (var i = 0; i < x.length; i += 16) {
            var olda = a;
            var oldb = b;
            var oldc = c;
            var oldd = d;
            var olde = e;

            for (var j = 0; j < 80; j++) {
                if (j < 16) w[j] = x[i + j];
                else w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
                var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)), safe_add(safe_add(e, w[j]), sha1_kt(j)));
                e = d;
                d = c;
                c = rol(b, 30);
                b = a;
                a = t;
            }

            a = safe_add(a, olda);
            b = safe_add(b, oldb);
            c = safe_add(c, oldc);
            d = safe_add(d, oldd);
            e = safe_add(e, olde);
        }
        return [a, b, c, d, e];

    }

    /*
     * Perform the appropriate triplet combination function for the current
     * iteration
     */
    function sha1_ft(t, b, c, d) {
        if (t < 20) return (b & c) | ((~b) & d);
        if (t < 40) return b ^ c ^ d;
        if (t < 60) return (b & c) | (b & d) | (c & d);
        return b ^ c ^ d;
    }

    /*
     * Determine the appropriate additive constant for the current iteration
     */
    function sha1_kt(t) {
        return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 : (t < 60) ? -1894007588 : -899497514;
    }

    /*
     * Calculate the HMAC-SHA1 of a key and some data
     */
    function core_hmac_sha1(key, data) {
        var bkey = str2binb(key);
        if (bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

        var ipad = new Array(16),
            opad = new Array(16);
        for (var i = 0; i < 16; i++) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }

        var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
        return core_sha1(opad.concat(hash), 512 + 160);
    }

    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
     * Bitwise rotate a 32-bit number to the left.
     */
    function rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
     * Convert an 8-bit or 16-bit string to an array of big-endian words
     * In 8-bit function, characters >255 have their hi-byte silently ignored.
     */
    function str2binb(str) {
        var bin = [];
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < str.length * chrsz; i += chrsz)
            bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i % 32);
        return bin;
    }

    /*
     * Convert an array of big-endian words to a string
     */
    function binb2str(bin) {
        var str = "";
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < bin.length * 32; i += chrsz)
            str += String.fromCharCode((bin[i >> 5] >>> (24 - i % 32)) & mask);
        return str;
    }

    /*
     * Convert an array of big-endian words to a hex string.
     */
    function binb2hex(binarray) {
        var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i++) {
            str += hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF) + hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8)) & 0xF);
        }
        return str;
    }

    /*
     * Convert an array of big-endian words to a base-64 string
     */
    function binb2b64(binarray) {
        var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i += 3) {
            var triplet = (((binarray[i >> 2] >> 8 * (3 - i % 4)) & 0xFF) << 16) | (((binarray[i + 1 >> 2] >> 8 * (3 - (i + 1) % 4)) & 0xFF) << 8) | ((binarray[i + 2 >> 2] >> 8 * (3 - (i + 2) % 4)) & 0xFF);
            for (var j = 0; j < 4; j++) {
                if (i * 8 + j * 6 > binarray.length * 32) str += b64pad;
                else str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
            }
        }
        return str;
    }

    core.extend({
        sha1: hex_sha1,
        sha1base64: b64_sha1,
        sha1str: str_sha1,
        hmacsha1: hex_hmac_sha1,
        hmacsha1base64: b64_hmac_sha1,
        hmacsha1str: str_hmac_sha1
    });

});
/**
 * 库核心方法集合
 *
 * @author Will.Ma
 * @date 2015-05-12
 * @version 0.1
 *
 * @author Will.Ma
 * @date 2015-12-03
 * @version 0.2
 * 通过模块化方式组织.
 *
 * @author Will.Ma
 * @date 2016-02-20
 * @version 0.3
 * 对组成模块进行拆分,同时引入部分新功能.
 *
 * @author Will.Ma
 * @date 2016-02-24
 * @version 1.0.0
 * 基本完成模块的组织和代码的编写,同时完成对requirejs编译等的研究
 *
 * @author Will.Ma
 * @date 2016-03-04
 * @version 1.0.1
 * 扩展了func,提供对象数组比较方法
 */

define('wlib',["wlib-core", "wlib-funcs", "wlib-jsfix", "wlib-md5", "wlib-base64", "wlib-sha1"], function (core) {

    return (window.wlib = core);

});

requirejs.config({
    baseUtl: "./"
});

require(['wlib'], function (wlib) {

});

define("config", function(){});

