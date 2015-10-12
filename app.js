/**
 * Created by Chen on 2015-10-10.
 */
var collector = require('./collector');

var taskList = collector.LoadTask();
var arguments = process.argv.splice(2);

if (arguments.length <= 0) {
    console.log("请输入任务名来执行本程序(e.g. >> node app demo)");
    console.log("可执行的任务为:");
    var str = "", seg = "";
    taskList.forEach(function (taskname) {
        str += seg + taskname;
        seg = ",";
    });
    console.log(str);
} else {
    var task = arguments[0];
    if (!HaveTask(task, taskList)) {
        console.log("没有找到该任务，请重试...");
    } else {
        console.log("开始执行采集任务。请稍后...");
        collector.RunTask(task);
    }
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