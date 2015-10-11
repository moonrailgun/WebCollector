/**
 * Created by Chen on 2015-10-10.
 */

var http = require('http');
var _url = require('url');    //引用url模块，处理url地址相关操作
var cheerio = require("cheerio");    //引用cheerio模块,使在服务器端像在客户端上操作DOM,不用正则表达式
var iconv = require('iconv-lite');    //解决编码转换模块
var BufferHelper = require('bufferhelper');
var fs = require('fs');//文件管理模块

var taskpath = "./tasks";
//加载第三方页面
function download(url, callback) {
    http.get(url, function (res) {
        var bufferHelper = new BufferHelper();//解决中文编码问题
        var bufferHelper;
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });
        res.on("end", function () {
            //注意，此编码必须与抓取页面的编码一致，否则会出现乱码，也可以动态去识别
            var val = iconv.decode(bufferHelper.toBuffer(), 'utf-8');
            callback(val);
        });
    }).on("error", function () {
        callback(null);
    });
}
function SavePic(url, dirpath) {
    http.get(url, function (res) {
        var imgData;
        var pathname = _url.parse(url).pathname;
        var pathnames = pathname.split('/');
        var picname = "/" + pathnames[pathnames.length - 1];

        res.setEncoding("binary"); //一定要设置response的编码为binary否则会下载下来的图片打不开

        res.on("data", function (chunk) {
            imgData += chunk;
        });

        res.on("end", function () {
            fs.writeFile(dirpath + picname, imgData, "binary", function (err) {
                if (err) {
                    console.log("down fail");
                }
                console.log("down success");
            });
        });
    });
}
