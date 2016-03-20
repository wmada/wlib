define(["wlib-core"], function (core) {

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