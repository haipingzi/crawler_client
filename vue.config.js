const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  pluginOptions: {
    electronBuilder: {
      preload: "src/preload.js",
      externals: ["puppeteer", "puppeteer-core"],
    },
  },
  // chainWebpack: (config) => {
  //   config.module
  //     .rule("js")
  //     .use("babel-loader")
  //     .loader("babel-loader")
  //     .tap((options) => {
  //       // 修改 babel-loader 的选项
  //       options.plugins = ["@babel/plugin-proposal-optional-chaining"];
  //       return options;
  //     });
  // },
});
