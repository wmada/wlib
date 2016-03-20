/**
 * wlib主要方法.
 *
 * @author will.ma
 * @date 2016-02-22
 */
define(["wlib-core"], function (core) {

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
