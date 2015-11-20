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

//生成采集地图
var GenerateCollectorMap = function (task) {
    var urlMapSelectior = task['urlMap'];
    var map = {};
    //根据不同的HTML对象返回不同的对象
    var GetObjByDom = function (dom) {
        var obj = {};
        var tagName = dom.name;
        if(tagName == 'a'){
            obj = {
                title: $(dom).text(),
                url: $(dom).attr('href')
            }
        }else if (tagName == 'img'){
            obj = {
                url: $(dom).attr('src')
            }
        }
        return obj;
    };

    //获取一页的URL地图，$为文档对象，page为URL选择器，callback为回调
    var GetPageMap = function ($, page, callback, upperlayerObj) {
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
        console.log('本次采集到' + pageUrlMap.length + '条数据:' + pageUrlMap[0]['title'] + "..." + pageUrlMap[0]['url']);

        if (callback) {
            callback(pageUrlMap, upperlayerObj);
        }else{
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
        if(typeof tmp == 'object'){
            tmp = tmp.concat(pageUrlMap);//把新数据连接到旧数据中
            upperlayerObj.content = tmp;
            console.log(upperlayerObj.content.length);
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