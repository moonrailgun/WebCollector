/**
 * Created by Chen on 2015-10-12.
 */

var cheerio = require("cheerio");    //引用cheerio模块,使在服务器端像在客户端上操作DOM,不用正则表达式
var httpHelper = require('./httpHelper');
var fs = require('fs');//文件管理模块
var _url = require('url');//路径解析

var taskpath = './tasks';//任务文件默认路径
var progresspath = './progress';//任务文件默认路径
var currentTask = {};//当前执行的任务

//读取任务列表
function LoadTask() {
    var files = fs.readdirSync(taskpath);
    var tasks = [];
    files.forEach(function (filename) {
        var str = filename.split('.');
        if (str[1] == "json") {
            tasks.push(str[0]);
        }
    });

    return tasks;
}

//执行任务,一切开始的地方
function RunTask(task) {
    var dat;
    if (typeof task != 'object') {
        dat = JSON.parse(task);
    } else {
        dat = task;
    }

    GenerateCollectorMap(dat);
}

//SavePic("http://img.taopic.com/uploads/allimg/130501/240451-13050106450911.jpg","./download");
//保存图片
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

//解析根页面
function AnalysisRootPage(doc, opt) {
    console.time("AnalysisPage");
    var selectior = opt.selectior;
    var content = selectior.content;

    console.log("采集任务：" + opt.name);

    //基本配置
    var parent = {};
    parent.url = opt.startURL;
    parent.title = opt.name;
    AnalysisSubPage(doc, content, parent, opt);//开始解析页面

    console.timeEnd("AnalysisPage");
}

//分析页面，从当前页获取子页URL，title。然后进入下载子页获取内容
//当前页面，内容选择器，任务设置
//todo mulPage,joint,type,nextPage处理，并发采集上限
function AnalysisSubPage(doc, content, parent, opt) {
    var $ = cheerio.load(doc, {decodeEntities: false});
    var parentUrl = parent.url;
    var parentTitle = parent.title;

    //解析内容
    if (typeof content == "object") {
        var subURL = content.subURL;
        var subTitle = content.subTitle;

        var urlList = [];
        var par = subURL.split(" ");
        if (par[par.length - 1] == "a") {
            $(subURL).attr('href', function (index, oldcontent) {
                urlList[index] = oldcontent;//将数据按顺序放到数组中
            });
        }
        var titleList = [];
        $(subTitle).text(function (index, oldcontent) {
            titleList.push(oldcontent.trim());
        });

        //循环遍历子页内容
        for (var i = 0; i < urlList.length; i++) {
            var url = urlList[i];
            if (url) {
                httpHelper.get(url, opt.timeout, function (err, val, url) {
                    if (err) {
                        console.error(err);
                    }
                    else {
                        var parent = {};
                        parent.url = url;
                        parent.title = titleList[urlList.indexOf(url)];
                        AnalysisSubPage(val, content.subContent, parent, opt);
                    }
                }, opt.encoding);
            }
        }
    } else if (typeof content == "string") {
        var pageContent = "";
        //如果是内容选择器是文本，则终止迭代，获取到的数据被回收
        $(content).text(function (index, oldcontent) {
            pageContent += oldcontent.trim() + "\n";
        });

        //todo 在多层迭代中需要进行修改
        var result = {
            url: parentUrl,
            title: parentTitle,
            content: pageContent
        };
        if (result) {
            currentTask.result.push(result);
            SaveProgress(currentTask);
        }
    }
}

var GenerateCollectorMap = function (task) {
    var urlMapSelectior = task['urlMap'];
    var urlMap = [];

    //获取一页的URL地图，$为文档对象，page为URL选择器，callback为回调
    var GetPageMap = function ($, page) {
        var urlSelectior = page.url;
        var nextSelectior = page.next;

        var pageUrlMap = [];
        var pageUrlList = $(urlSelectior);
        for (var i = 0; i < pageUrlList.length; i++) {
            var dat = pageUrlList[i];
            pageUrlMap.push({
                title: $(dat).text(),
                url: $(dat).attr('href')
            });
        }
        urlMap = urlMap.concat(pageUrlMap);
        console.log('已采集数据' + urlMap.length);
        GetNextPage($, page);
    };
    //获取下一页
    var GetNextPage = function ($, page) {
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
                    GetPageMap($, page);
                }
            }, task.encoding);
        } else {
            console.log('URL地图采集结束。数据保存中...');
            SaveMap();
        }
    };
    var SaveMap = function () {
        var fn = progresspath + '/' + task.name + "_map.json";
        fs.writeFile(fn, JSON.stringify(urlMap), function (err) {
            if (err) throw err;

            console.log('地图数据已经被保存'); //文件被保存
        })
    };

    //添加退出事件监听
    process.on('SIGINT', function() {
        SaveMap();
        console.log('请使用 Ctrl + D 退出');
    });
    httpHelper.get(task.startURL, task.timeout, function (err, val, href) {
        if (err) {
            console.error(href.toString() + ":" + err);
        } else {
            $ = cheerio.load(val, {decodeEntities: false});//读取文本
            var page = urlMapSelectior.page;
            GetPageMap($, page);//获取起始页数据
        }
    }, task.encoding);
};

//采集数据进度存储
function SaveProgress(taskjson) {
    var fn = progresspath + '/' + taskjson.name + ".json";
    fs.writeFile(fn, JSON.stringify(taskjson), function (err) {
        if (err) throw err;
        console.log('进度已经被保存'); //文件被保存
    })
}

//保存数据简单封装
function SaveFile(path, text, func) {
    fs.write(path, text, function (err) {
        if (err) throw err;
        func();
    });
}

exports.LoadTask = LoadTask;
exports.RunTask = RunTask;
exports.GenerateCollectorMap = GenerateCollectorMap;