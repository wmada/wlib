/**
 * wlib核心,其它模块均由此基础进行扩展.
 *
 * @author will.ma
 * @date 2016-02-21
 */
define([], function () {

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
