/**
 * Created by Chen on 2015-10-12.
 */

var cheerio = require("cheerio");    //引用cheerio模块,使在服务器端像在客户端上操作DOM,不用正则表达式
var httpHelper = require('./httpHelper');
var fs = require('fs');//文件管理模块

var taskpath = './tasks';//任务文件默认路径

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

//执行任务
function RunTask(task) {
    var taskfilepath = taskpath + "/" + task + ".json";
    fs.readFile(taskfilepath, {encoding: "utf-8"}, function (err, data) {
        if (err) throw err;

        console.log("任务详细内容:");
        console.log(data);
        var json = JSON.parse(data);

        var startURL = json.startURL;
        var timeout = json.timeout;
        var encoding = json.encoding;
        //获取起始页数据并分析
        httpHelper.get(startURL, timeout, function (err, val) {
            if (err) {
                console.error(err);
            }
            else {
                AnalysisRootPage(val, json);
            }
        }, encoding);
    });
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
    AnalysisSubPage(doc, content,parent, opt);//开始解析页面

    console.timeEnd("AnalysisPage");
}

//分析页面，从当前页获取子页URL，title。然后进入下载子页获取内容
//当前页面，内容选择器，任务设置
//todo mulPage,joint,type处理
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
            if(url){
                httpHelper.get(url, opt.timeout, function (err, val, url) {
                    if (err) {
                        console.error(err);
                    }
                    else {
                        var parent = {};
                        parent.url = url;
                        parent.title = titleList[urlList.indexOf(url)];
                        AnalysisSubPage(val, content.subContent, parent , opt);
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

        console.log("-----------------------------" + parentUrl);
        if(pageContent){
            console.log("最终数据:"+ parentTitle + "\t\t\t---\t\t\t" +pageContent);
        }else{
            console.log("没有采集到任何数据");
        }
        console.log();
    }
}

exports.LoadTask = LoadTask;
exports.RunTask = RunTask;
exports.SavePic = SavePic;
exports.AnalysisRootPage = AnalysisRootPage;
exports.AnalysisSubPage = AnalysisSubPage;