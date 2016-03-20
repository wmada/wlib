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

define(["wlib-core", "wlib-funcs", "wlib-jsfix", "wlib-md5", "wlib-base64", "wlib-sha1"], function (core) {

    return (window.wlib = core);

});
