/**
 * Created by Chen on 2015-10-10.
 */

var http = require('http');
var _url = require('url');    //引用url模块，处理url地址相关操作
var cheerio = require("cheerio");    //引用cheerio模块,使在服务器端像在客户端上操作DOM,不用正则表达式
var iconv = require('iconv-lite');    //解决编码转换模块
var BufferHelper = require('bufferhelper');
var fs = require('fs');//文件管理模块
var httpHelper = require('./httpHelper');

var taskpath = "./tasks";
/*
 *最后我需要达到的效果是，给予一个访问地址，形如：http://www.mynode.com?link=www.abc.com&callback=cb
 *我希望可以返回json，也可返回jsonp
 */
/*
 http.createServer(function (req, res) {
 var arg = _url.parse(req.url, true).query;    //通过调用url模块，获取查询字符串参数集合
 var link = arg.link;    //获取抓取的link
 var callback = arg.callback;    //回调函数的名称
 //若没有对link加上http，则补全
 var protocol = "http";
 if (link.indexOf("http") < 0) {
 link = protocol + "://" + link;
 }
 //抓取页面
 download(link, function (data) {
 res.writeHead(200, {
 "Content-Type": "text/html;charset=utf-8",
 "Transfer-Encoding": "chunked"
 });
 var doc = data.toString();
 var $ = cheerio.load(doc);
 var list = [];
 $(".e2 li .title").each(function (i, e) {
 var item = $(e).children("a").last();
 var title = item.text();
 var link = item.attr("href");
 list.push({"title": title, "link": link});
 });
 var jsonText = JSON.stringify(list);
 if (callback) {
 res.write(callback + "(" + jsonText + ")");
 }
 else {
 res.write(jsonText);
 }
 res.end();
 });
 }).listen(3000);
 */

var taskList = LoadTask();
var arguments = process.argv.splice(2);

if (arguments.length > 0) {
    var task = arguments[0];
    if (HaveTask(task, taskList)) {
        console.log("开始执行采集任务。请稍后...");
        RunTask(task);
    }
    else {
        console.log("没有找到该任务，请重试...");
    }
}
else {
    console.log("请输入任务名来执行本程序(e.g. >> node app demo)");
    console.log("可执行的任务为:");
    var str = "", seg = "";
    taskList.forEach(function (taskname) {
        str += seg + taskname;
        seg = ",";
    });
    console.log(str);
}

//SavePic("http://img.taopic.com/uploads/allimg/130501/240451-13050106450911.jpg","./download");
//download("http://www.tuicool.com/articles/2UrIz2f", function(val){
//    console.log(val);
//});
//
////加载第三方页面
//function download(url, callback, encoding) {
//    if (!encoding) {
//        encoding = "utf-8";
//    }
//
//    console.log(encoding);
//
//    http.get(url, function (res) {
//        var bufferHelper = new BufferHelper();//解决中文编码问题
//        var bufferHelper;
//        res.on('data', function (chunk) {
//            bufferHelper.concat(chunk);
//        });
//        res.on("end", function () {
//            //注意，此编码必须与抓取页面的编码一致，否则会出现乱码，也可以动态去识别
//            var val = iconv.decode(bufferHelper.toBuffer(), encoding);
//            callback(val);
//        });
//    }).on("error", function () {
//        callback(null);
//    });
//}

//读取任务
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

/**
 * @return {boolean}
 */
function HaveTask(task, tasklist) {
    for (var i in tasklist) {
        if (task == tasklist[i]) {
            return true;
        }
    }
    return false;
}