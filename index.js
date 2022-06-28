const fs = require("fs");
const path = require('path');
const resourcePath = '';
require("colors");
const shell = require("shelljs");

const LINE = (process.env.npm_config_user_agent.indexOf('win') != -1) ? '\r\n' : '\n';

let _d = new Date();
const BUILD_YEAR = _d.getFullYear();
const BUILD_TIME = _d.getFullYear() + '-' + (_d.getMonth() + 1) + '-' + _d.getDate() + ' ' + _d.getHours() +
    ':' + _d.getMinutes() + ':' + _d.getSeconds();


function WefowardVueBuilder() {
    //版本保存
    let _packagePath = process.env.WF_BUILD_PACKAGE_JS ? process.env.WF_BUILD_PACKAGE_JS : 'package.json';
    this.packagePath = path.resolve(process.cwd(), _packagePath);
    let _options = require(path.resolve(process.cwd(), _packagePath));
    this.options = _options;
    this.name = _options.name;
    this.version = _options.version;
    this.hosts = exchangeHostToHosts(process.env.VUE_APP_WF_HOST);
    this.isPackage = process.env.WF_BUILD_IS_PACKAGE;
    this.isGrowVersion = process.env.WF_BUILD_IS_GROW_VERSION;
    this.isDist = process.env.WF_BUILD_IS_DIST;
    this.disthubUrl = process.env.WF_BUILD_DISTHUB_URL;
    this.distAuthorization = process.env.WF_BUILD_DIST_AUTHORIZATION;
    this.isCommit = process.env.WF_BUILD_IS_COMMIT;
    this.isTag = this.isGrowVersion || process.env.WF_BUILD_IS_TAG;
}

WefowardVueBuilder.prototype.apply = function (compiler) {
    let plugin = this;
    //编译完成监听
    compiler.hooks.done.tap('done', function () {
        //删除svn文件
        emptyDir(path.resolve(process.cwd(), 'dist/.svn'));
        //删除git文件
        emptyDir(path.resolve(process.cwd(), 'dist/.git'));
        if (plugin.isPackage) {
            let versions = plugin.version.split(".");
            let mainVersion = versions[0];
            let numberVersion = versions[1];
            let serialVersion = versions[2];
            let _fullVersion;
            if (plugin.isGrowVersion) {
                numberVersion++;
                _fullVersion = mainVersion + "." + numberVersion + "." + serialVersion;
                changeVersion(plugin, _fullVersion);
            } else {
                _fullVersion = plugin.version;
            }
            let indexPath = path.resolve(process.cwd(), 'dist/index.html');
            replaceContent(indexPath, plugin);

            let jsDir = path.resolve(process.cwd(), 'dist/js/');
            if (fs.existsSync(jsDir)) {
                fs.readdirSync(jsDir).forEach(function (file) {
                    let pathname = path.join(jsDir, file);
                    replaceContent(pathname, plugin);
                })
            }
            let cssDir = path.resolve(process.cwd(), 'dist/css/');
            if (fs.existsSync(cssDir)) {
                fs.readdirSync(cssDir).forEach(function (file) {
                    let pathname = path.join(cssDir, file);
                    replaceContent(pathname, plugin);
                })
            }
            let versionPath = path.resolve(process.cwd(), 'dist/js/wfversion.js');
            if (fs.existsSync(versionPath)) {
                let injectcontent = 'window._WEFORWARD_VERSION= ' +
                    JSON.stringify({
                        version: _fullVersion,
                        buildTime: BUILD_TIME,
                        buildType: plugin.buildType,
                        name: plugin.name
                    });
                appendContent(versionPath, injectcontent)
            }
            let configPath = path.resolve(process.cwd(), 'dist/js/wfconfig.js');
            if (plugin.hosts && fs.existsSync(configPath)) {
                let injectcontent = 'window._WEFORWARD_CONFIG=' + JSON.stringify({
                    hosts: plugin.hosts
                });
                appendContent(configPath, injectcontent)
            }
        }
        if (plugin.isDist) {
            compressToZip(function () {

                if (!plugin.disthubUrl) {
                    console.log('disthubUrl is empty，commit failed!'.red);
                    return;
                }
                commitFile(plugin, plugin.disthubUrl, plugin.distAuthorization);

            });
        }
        //打包提交git仓库
        if (plugin.isCommit) {
            commitGit(plugin)
        }
        //打包提交git标签
        if(plugin.isTag){
            createGitTag(plugin)
        }
    });

};

//保存版本
function changeVersion(plugin, version) {
    plugin.version = version;
    //版本保存
    let _packagePath = plugin.packagePath;
    plugin.options.version = version;
    console.log(_packagePath)
    fs.writeFileSync(_packagePath, JSON.stringify(plugin.options, null, "\t"));
    console.log("Build " + version + " success");

    let mfpath = path.resolve(process.cwd(), 'dist/MAINIFEST.MF');
    let context = "";
    context += "Manifest-Version: 1.0"
    context += LINE;
    context += "Implementation-Version: " + version;
    context += LINE;
    context += "Created-By: Weforward Build";
    context += LINE;
    context += "Copyright: Weforward (c) " + BUILD_YEAR;
    context += LINE;
    context += "Built-Date: " + BUILD_TIME;
    context += LINE;
    context += "Extension-Name:" + plugin.name;
    fs.writeFileSync(mfpath, context);
    console.log("Version " + version);
}

/**
 * 替换内容
 * @param {Object} path 文件路径
 * @param {Object} plugin 插件对象
 */
function replaceContent(path, plugin) {
    let versions = plugin.version.split(".");
    let mainVersion = versions[0];
    let numberVersion = versions[1];
    let tag = mainVersion + "." + numberVersion;
    if (fs.existsSync(path)) {
        let file = fs.readFileSync(path);
        let source = file.toString();
        source = source.replace(/#{name}/g, plugin.name);
        source = source.replace(/#{tag}/g, tag);
        fs.writeFileSync(path, source);
    }
}

/**
 * 追加内容
 * @param {Object} path 文件路径
 * @param {Object} content 文件内容
 */
function appendContent(path, content) {
    let file = fs.readFileSync(path);
    let source = file.toString();
    if (source) {
        source = source + LINE + content;
    } else {
        source = content;
    }
    fs.writeFileSync(path, source);
}

/**
 * 压缩目录
 * @param {Object} callback
 */
function compressToZip(callback) {
    console.log('compressToZip begin');
    let src = path.resolve(process.cwd(), 'dist');
    let outpath = path.join(process.cwd(), '../dist.zip');
    const archiver = require("archiver");
    var output = fs.createWriteStream(outpath);
    let archive = archiver('zip', {
        zlib: {
            level: 9
        }
    });
    archive.pipe(output);
    archive.directory(src, false);
    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        if (callback) {
            callback();
        }
    });
    archive.finalize();
}

function commitFile(plugin) {
    var request = require('request');
    let versions = plugin.version.split(".");
    let mainVersion = versions[0];
    let numberVersion = versions[1];
    let tag = mainVersion + "." + numberVersion;
    let url = plugin.disthubUrl + plugin.name + '/' + tag + '/file.zip';
    let filePath = path.resolve(process.cwd(), '../dist.zip');
    let filestate = fs.statSync(filePath);
    console.log('committing,size:' + filestate.size + ',url:' + url);
    let headers = {};
    let authorization = plugin.distAuthorization;
    if (authorization) {
        let Base64 = require('js-base64').Base64;
        headers.Authorization = 'Basic ' + Base64.encode(authorization);
        console.log('Authorization:' + headers.Authorization);
    }
    request.post({
        url: url,
        headers: headers,
        formData: {
            file: fs.createReadStream(filePath)
        }
    }, function (error, response, body) {
        fs.unlinkSync(filePath);
        if (response) {
            if (response.statusCode == 200) {
                console.log('commit success!'.green);
            } else if (response.statusCode == 401) {
                console.log('Authentication failed!'.red);
            } else {
                let info = (response.statusCode || 'commit failed!') + '';
                console.error(info.red);
            }
        } else {
            let info = (error || response.statusCode || 'commit failed!') + '';
            console.error(info.red);
        }
    })
}

//清空目录操作
function emptyDir(path) {
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            let curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                // recurse
                emptyDir(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

/**
 * @param {Object} hostdesc 多域名处理
 */
function exchangeHostToHosts(hostdesc) {
    let _host = (hostdesc || '').split(',');
    return _host;
}

// 上传代码到git仓库
function commitGit(plugin) {
    let versions = plugin.version.split('.')
    let mainVersion = versions[0]
    let numberVersion = versions[1]
    numberVersion++
    let _fullVersion = mainVersion + '.' + numberVersion
    shell.exec('git add .', {}, () => {
        shell.exec(`git commit -m 打包提交${_fullVersion}版本代码`, {}, () => {
            shell.exec(`git push`, {}, data => {
                shell.echo(`代码提交成功`)
            })
        })
    })
}

// 创建当前代码标签
function createGitTag(plugin) {
    let versions = plugin.version.split('.')
    let mainVersion = versions[0]
    let numberVersion = versions[1]
    numberVersion++
    let version = mainVersion + '.' + numberVersion
    shell.exec(`git tag -a ${version} -m 创建版本号为${version}标签`, {}, () => {
        shell.exec(`git push origin ${version}`, {}, () => {
            shell.echo('标签创建提交成功')
        })
    })
}

module.exports = WefowardVueBuilder;
