/**
 * Created by Chen on 2015-11-20.
 */
var cheerio = require("cheerio");    //引用cheerio模块,使在服务器端像在客户端上操作DOM,不用正则表达式
var httpHelper = require('./httpHelper');
var fs = require('fs');//文件管理模块
var progresspath = './progress';//任务文件默认路径

//生成采集地图
var mapGenerator = function (task) {
    var urlMapSelectior = task['urlMap'];
    var map = {};
    var collectNum = 0;
    //根据不同的HTML对象返回不同的对象
    var GetObjByDom = function (dom) {
        var obj = {};
        var tagName = dom.name;
        if (tagName == 'a') {
            obj = {
                title: $(dom).text(),
                url: $(dom).attr('href')
            }
        } else if (tagName == 'img') {
            obj = {
                url: $(dom).attr('src')
            }
        }
        return obj;
    };

    //获取一页的URL地图，$为文档对象，page为URL选择器，callback为回调
    var GetPageMap = function ($, page, callback, upperlayerObj) {
        collectNum++;//采集次数累加
        var urlSelectior = page.url;
        var nextSelectior = page.next;

        var pageUrlMap = [];
        var pageUrlList = $(urlSelectior);
        for (var i = 0; i < pageUrlList.length; i++) {
            var dat = pageUrlList[i];
            var obj = GetObjByDom(dat);
            pageUrlMap.push(obj);

            //异步获取下一级页面
            if (page.page) {
                obj.content = [];
                GetSublayerMap(obj, page.page);
            }
        }
        if (pageUrlMap[0]['title']) {
            console.log('[累计采集数据量:' + collectNum + ']本次采集到' + pageUrlMap.length + '条数据:' + pageUrlMap[0]['title'] + "...");
        }

        if (callback) {
            callback(pageUrlMap, upperlayerObj);
        } else {
            ConcatObj(pageUrlMap, upperlayerObj);
        }

        //如果有下一页就获取下一页
        if (nextSelectior) {
            GetNextPage($, page, function ($, page, upperlayerObj) {
                //自我迭代
                GetPageMap($, page, ConcatObj, upperlayerObj);
            }, upperlayerObj);
        }
    };
    //连接数据
    var ConcatObj = function (pageUrlMap, upperlayerObj) {
        var tmp = upperlayerObj.content;
        if (typeof tmp == 'object') {
            tmp = tmp.concat(pageUrlMap);//把新数据连接到旧数据中
            upperlayerObj.content = tmp;
        }
    };
    //获取下一页数据
    var GetNextPage = function ($, page, callback, upperlayerObj) {
        var nextSelectior = page.next;
        var $next = $(nextSelectior);
        if ($next) {
            var nextUrl;
            //获取最后一个匹配到的对象
            if ($next.length > 1) {
                nextUrl = $($next[$next.length - 1]).attr('href');
            } else {
                nextUrl = $(nextSelectior).attr('href');
            }

            httpHelper.get(nextUrl, task.timeout, function (err, val) {
                if (err) {
                    console.error(err);
                } else {
                    var $ = cheerio.load(val, {decodeEntities: false});//读取文本
                    if (callback) {
                        callback($, page, upperlayerObj);
                    }
                }
            }, task.encoding);
        } else {
            console.log('数据保存中...');
            SaveMap(function () {
                console.log('地图数据已经被保存'); //文件被保存
            });
        }
    };
    //保存到地图文件(覆盖保存)
    var SaveMap = function (callback) {
        var fn = progresspath + '/' + task.name + "_map.json";
        fs.writeFile(fn, JSON.stringify(map), function (err) {
            if (err) throw err;

            if (callback) {
                callback(map.length);
            }
        })
    };
    //获取下一层数据,page为URL选择器
    var GetSublayerMap = function (upperlayerObj, page) {
        var url = upperlayerObj.url;
        httpHelper.get(url, task.timeout, function (err, val, href) {
            if (err) {
                console.error(href.toString() + ":" + err);
            } else {
                $ = cheerio.load(val, {decodeEntities: false});//读取文本
                GetPageMap($, page, ConcatObj, upperlayerObj);
            }
        }, task.encoding);
    };

    //添加退出事件监听
    process.on('SIGINT', function () {
        SaveMap(function () {
            process.exit();//退出应用
        });
    });

    //开始运行
    httpHelper.get(task.startURL, task.timeout, function (err, val, href) {
        if (err) {
            console.error(href.toString() + ":" + err);
        } else {
            $ = cheerio.load(val, {decodeEntities: false});//读取文本
            var page = urlMapSelectior.page;
            map.content = [];
            GetPageMap($, page, ConcatObj, map);//获取起始页数据
        }
    }, task.encoding);
};

module.exports = mapGenerator;