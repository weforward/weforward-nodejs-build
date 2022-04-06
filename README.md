# weforward项目构建依赖插件


需要配合weforward项目的配置文件使用
```js
//vue.config.js
const isProduction = process.env.NODE_ENV === 'production';
module.exports = {
	publicPath: process.env.VUE_APP_WF_PUBLICPATH,
	devServer: {
		//前端页面的访问端口
		port: 8080,
	},
	configureWebpack: config => {
		if (isProduction) {
			const builder = require('weforward-builder');
			config.plugins.push(new builder());
		}
	},
	filenameHashing: true,
	productionSourceMap: false
}

```

环境变量
```
#NODE 环境
NODE_ENV=production

# APP公开入口
VUE_APP_WF_PUBLICPATH=/#{name}/#{tag}/

#接口域名，多个时使用英文逗号隔开
VUE_APP_WF_HOST=//wf.weforward.xyz

#是否增长版本
WF_BUILD_IS_GROW_VERSION=true

#是否打包
WF_BUILD_IS_PACKAGE=true

#是否发布
WF_BUILD_IS_DIST=true

#项目编译后提交的路径
WF_BUILD_DISTHUB_URL=http://xxxx/dist/html/

#编译并提交项目需要鉴权，内容格式为"用户名:密码"
#WF_BUILD_DIST_AUTHORIZATION=xxx:xxx

#多项目结构时使用，指定项目的package.json，不指定默认使用package.js
#WF_BUILD_PACKAGE_JS=./src/mypackage.json

```