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
        httpHelper.get(startURL, timeout, function (err, val) {
            if (err) {
                console.error(err);
            }
            else {
                AnalysisPage(val, json);
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


//解析页面
function AnalysisPage(doc, opt) {
    console.time("AnalysisPage");
    var selectior = opt.selectior;
    var title = selectior.title;
    var content = selectior.content;
    var $ = cheerio.load(doc, {decodeEntities: false});

    var pageTitle = $(title).html();
    var pageContent = "";
    if (typeof content == "string") {
        $(content).text(function (index, oldcontent) {
            pageContent += oldcontent.trim() + "\n";
        });
    }
    else if (typeof content == "object") {
        var subURL = content.subURL;
        var subTitle = content.subTitle;
        var urlList = [];
        var par = subURL.split(" ");
        if(par[par.length - 1] == "a"){
            $(subURL).attr('href',function (index, oldcontent) {
                urlList[index] = oldcontent;
            });
        }
        var titleList = [];
        $(subTitle).text(function (index, oldcontent) {
            titleList.push(oldcontent.trim());
        });

        //查找子页内容
        for(var i = 0;i<1;i++)
        {
            var url = urlList[i];
            httpHelper.get(url, opt.timeout, function (err, val,url) {
                if (err) {
                    console.error(err);
                }
                else {
                    var $temp = cheerio.load(val, {decodeEntities: false});
                    console.log($temp(content.subContent).html());
                    console.log("--------------------------------------"+url);
                }
            }, opt.encoding);
        }
    }

    console.log(pageContent);
    console.timeEnd("AnalysisPage");
}

exports.LoadTask = LoadTask;
exports.RunTask = RunTask;
exports.SavePic = SavePic;
exports.AnalysisPage = AnalysisPage;