/**
 * @author will.ma
 * @date 2016-02-23
 */
requirejs.config({
    baseUrl: '../dist',
    paths: {
        wlib: 'wlib'
    }
});

require(['wlib'], function (Utils) {
    window.Utils = Utils;
});
