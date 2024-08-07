import Store from "electron-store";
import { app } from "electron";
import path from "path";
import axios from "axios";
import os from "os";
import fs from "fs";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import crypto from "crypto";
import puppeteer from "puppeteer";
import { COOKIE_MAP } from "@/config/baseConfig";

export const defaultConfig = {
  showBrowser: false,
  loadMore: false,
  autoCloseBrowser: true,
  proxyAddress: "",
  useProxy: false,
  supportedFileTypes: ["image", "video"],
};
export const cacheFilePath = path.join(
  app.getPath("userData"),
  "cacheWebsites.json"
);
export const defaultDownloadPath = path.join(os.homedir(), "Downloads");

export const store = new Store();
export let downloadRecords = store.get("downloadRecords", {});

export const instance = axios.create();
instance.interceptors.request.use(
  (config) => {
    const { proxyAddress, useProxy } = store.get("config", defaultConfig);
    if (useProxy && proxyAddress) {
      // 设置代理
      const httpAgent = new HttpProxyAgent(proxyAddress);
      const httpsAgent = new HttpsProxyAgent(proxyAddress);

      config.httpAgent = httpAgent;
      config.httpsAgent = httpsAgent;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export function parsePathObj(url) {
  try {
    // 使用 split 方法分割文件名和后缀
    const { name, ext, base } = path.parse(url.split("?")[0]);
    return {
      base,
      name,
      ext,
    };
  } catch (error) {
    console.error("parsePathObj", error);
  }
}

export function addDownloadRecords(url, savePath) {
  if (!downloadRecords[url]) {
    downloadRecords[url] = [];
  }
  const { base, name, ext } = parsePathObj(savePath);
  downloadRecords[url].push({
    path: savePath,
    fileName: base,
    name,
    ext,
  });
  store.set("downloadRecords", downloadRecords);
}

export function removeDownloadRecord(url, savePath) {
  if (!downloadRecords[url]) {
    downloadRecords[url] = [];
  }
  downloadRecords[url] = downloadRecords[url].filter(
    (item) => item.path !== savePath
  );

  store.set("downloadRecords", downloadRecords);
}

export function isSuportType(contentType) {
  const { supportedFileTypes } = store.get("config", defaultConfig);
  return supportedFileTypes.some((type) => contentType.includes(type));
}

export const parsedPath = ({ src: url, type }) => {
  if (url.startsWith("data:image/")) {
    const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      const ext = `.${matches[1].split("/")[1]}`;
      const name = generateRandomFileName();
      return {
        url,
        name,
        base: `${name}${ext}`,
        ext,
        type,
      };
    }
  }
  const parseUrl = parsePathObj(url);
  const { name, base, ext } = parseUrl;
  let extStr = ext;
  if (!extStr) {
    if (type === "video") {
      extStr = ".mp4";
    } else if (type === "image") {
      extStr = ".png";
    }
  }

  return {
    url,
    name,
    base,
    ext: extStr,
    type,
  };
};

// 定义自动滚动函数
export const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

// 自动滚动页面并加载更多内容
export const loadMoreContent = async (page) => {
  let previousHeight;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    previousHeight = await page.evaluate("document.body.scrollHeight");
    await autoScroll(page);
    const newHeight = await page.evaluate("document.body.scrollHeight");
    if (newHeight === previousHeight) {
      break; // 如果页面高度没有变化，说明没有更多内容加载
    }
  }
};

export const getFiles = async (page, supportedFileTypes) => {
  const files = [];

  if (supportedFileTypes.includes("image")) {
    const imgElements = await page.evaluate(() => {
      return Array.from(
        new Set(
          Array.from(document.querySelectorAll("img")).map((img) => img.src)
        )
      ).map((src) => ({ src, type: "image" }));
    });
    const styleElements = await page.evaluate(() => {
      const imgs = [];
      Array.from(document.querySelectorAll("[style]")).forEach((el) => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        const bgUrl = bgImage && bgImage.match(/url\(["']?([^"']*)["']?\)/);
        if (bgUrl && !imgs.includes(bgUrl[1])) {
          imgs.push(bgUrl[1]);
        }
      });

      return imgs.map((src) => ({ src, type: "image" }));
    });
    files.push(...imgElements, ...styleElements);
  }

  if (supportedFileTypes.includes("video")) {
    const videoElements = await page.evaluate(async () => {
      const videoEls = Array.from(document.querySelectorAll("video"));
      // fetch("blob:https://www.douyin.com/05da919a-d75a-453a-b36a-e26c2ee400f7")
      //   .then((response) => response.blob())
      //   .then((blob) => {
      //     return new Promise((resolve, reject) => {
      //       const reader = new FileReader();
      //       reader.onload = () => resolve(reader.result);
      //       reader.onerror = reject;
      //       reader.readAsDataURL(blob);
      //     });
      //   })
      //   .then((res) => {
      //     console.log(res);
      //   });

      if (videoEls && videoEls.length > 0) {
        const videoPromise = [];
        videoEls.forEach(async (video) => {
          let videoUrl = video.src;
          const sourceElement = video.querySelector("source");
          if (sourceElement && sourceElement.src) {
            videoUrl = sourceElement.src;
          }

          if (videoUrl && videoUrl.length > 0) {
            videoPromise.push(
              new Promise((resolve, reject) => {
                video.addEventListener("canplaythrough", () => {
                  resolve(video.src);
                });
                video.addEventListener("error", reject);
              })
            );
            if (videoUrl && videoUrl.startsWith("blob:")) {
              console.log("blobUrl:", videoUrl);
              // 将 blob URL 转换为视频流并下载
              const videoResponse = await page.evaluate((videoUrl) => {
                return fetch(videoUrl)
                  .then((response) => response.blob())
                  .then((blob) => {
                    return new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result);
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });
                  });
              }, videoUrl);

              const base64Data = videoResponse.split(",")[1];
              console.log("blobUrl:uccccccc");
              const buffer = Buffer.from(base64Data, "base64");

              fs.writeFile("video.mp4", buffer);
            }
          }
        });
        const videosRes = await Promise.all(videoPromise);
        return Array.from(new Set(videosRes)).map((src) => ({
          src,
          type: "video",
        }));
      }
      return [];
    });
    console.log("videoElements", videoElements);
    files.push(...videoElements);
  }
  console.log("files", files);
  return files;
};

export const ensureUniqueFilePath = (filePath) => {
  let counter = 1;
  let uniquePath = filePath;
  const extension = path.extname(filePath);
  const basename = path.basename(filePath, extension);
  const dirname = path.dirname(filePath);

  while (fs.existsSync(uniquePath)) {
    uniquePath = path.join(dirname, `${basename}(${counter})${extension}`);
    counter++;
  }
  return uniquePath;
};
export function generateRandomFileName() {
  return crypto.randomBytes(16).toString("hex");
}

export function getFileType(contentType) {
  if (!contentType) return "";
  return contentType.split("/")[0];
}
export let cacheWebsites;

export function loadCacheWebsite() {
  if (!cacheWebsites) {
    try {
      if (fs.existsSync(cacheFilePath)) {
        const data = fs.readFileSync(cacheFilePath);
        cacheWebsites = JSON.parse(data) || {};
      }
    } catch (error) {
      console.log("Failed to load cache:", error);
      cacheWebsites = {};
    }
  }
  return cacheWebsites;
}

export function saveCacheWebsite(data) {
  cacheWebsites = data;
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
}
let curBrowser;
export async function getBrowser(showBrowser = true) {
  if (!curBrowser) {
    curBrowser = await puppeteer.launch({
      headless: !showBrowser,
      args: ["--ignore-certificate-errors", "--disable-http2"],
    });
  }
  return curBrowser;
}

export function isNeedUrl(pageUrl, src, contentType) {
  const { url, name } = parsedPath({
    src,
    type: getFileType(contentType),
  });
  if (pageUrl.startsWith("https://v.douyin.com/")) {
    return (
      url.startsWith("https://v5-dy-o-abtest.zjcdn.com/") &&
      name === "media-video-hvc1"
    );
  }

  if (pageUrl.startsWith("http://xhslink.com")) {
    return url.startsWith("https://sns-video-hw.xhscdn.com/stream");
  }

  if (pageUrl.startsWith("https://b23.tv")) {
    return url.startsWith("https://upos-hz-mirrorakam.akamaized.net/upgcxcode");
  }

  if (pageUrl.startsWith("https://weibo.com")) {
    return url.startsWith("https://f.video.weibocdn.com");
  }

  return true;
}

export const parseCookies = (cookieString, domain) => {
  const cookies = cookieString
    .split(/;\s*/)
    .map((cookie) => {
      const [name, ...rest] = cookie.split("=");
      return {
        name,
        value: rest.join("="),
        domain,
        path: "/",
      };
    })
    .filter((cookie) => cookie.name && cookie.value);
  return cookies;
};

export async function setCookie(page, pageUrl) {
  let cookies = [];
  if (pageUrl.includes("douyin.com")) {
    cookies = parseCookies(COOKIE_MAP.dy, ".douyin.com");
  } else if (pageUrl.includes("weibo.com")) {
    cookies = parseCookies(COOKIE_MAP.wb, ".weibo.com");
  } else if (
    pageUrl.startsWith("https://b23.tv") ||
    pageUrl.includes("bilibili.com")
  ) {
    cookies = parseCookies(COOKIE_MAP.bili, ".bilibili.com");
  } else if (
    pageUrl.includes("xhslink.com") ||
    pageUrl.includes("xiaohongshu.com")
  ) {
    cookies = parseCookies(COOKIE_MAP.xiaohushu, ".xiaohongshu.com");
  }

  await page.setCookie(...cookies);
}

export const onResponse = (response, pageUrl, callback) => {
  const url = response.url();
  const headers = response.headers();
  const contentType = headers["content-type"];

  if (contentType && isSuportType(contentType)) {
    // isNeedUrl(pageUrl, url, contentType)
    const item = parsedPath({
      src: url,
      type: getFileType(contentType),
    });

    if (!cacheWebsites[pageUrl]) {
      cacheWebsites[pageUrl] = [];
    }
    if (!cacheWebsites[pageUrl].some((i) => i.url === item.url)) {
      console.log("item", item);
      callback && callback(true, item);
      cacheWebsites[pageUrl].push(item);
      global.mainWindow.webContents.send("file-url", item);
      saveCacheWebsite(cacheWebsites);
    }
  }
};

export async function openBrowser(pageUrl, { onResponse }, callback) {
  try {
    if (cacheWebsites[pageUrl] && cacheWebsites[pageUrl].length > 0) {
      callback && callback(true, cacheWebsites[pageUrl][0]);
      return cacheWebsites[pageUrl];
    }
    const { showBrowser, loadMore, autoCloseBrowser } = store.get(
      "config",
      defaultConfig
    );
    const curBrowser = await getBrowser(showBrowser);

    const curPage = await curBrowser.newPage();
    const allCookies = await curPage.cookies();
    if (!allCookies || allCookies.length === 0) {
      await setCookie(curPage, pageUrl);
    }

    curPage.on("response", (response) => {
      onResponse(response, pageUrl, callback);
    });

    await curPage.goto(pageUrl, { waitUntil: "networkidle2", timeout: 0 });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (loadMore) {
      // 加载所有内容
      await loadMoreContent(curPage);
    }
    if (autoCloseBrowser) {
      closeBrowser(curBrowser, curPage);
    }
  } catch (error) {
    console.log(error);
    let errorMessage = "抓取文件时发生错误。";

    if (error.message.includes("net::ERR_INTERNET_DISCONNECTED")) {
      errorMessage = "互联网连接已断开。请检查您的连接，然后重试。";
    } else if (error.message.includes("net::ERR_NAME_NOT_RESOLVED")) {
      errorMessage = "无法解析 URL。请检查 URL 然后重试。";
    } else if (error.message.includes("net::ERR_ABORTED")) {
      errorMessage = "请求已中止。请重试。";
    } else if (error.message.includes("Timeout")) {
      errorMessage = "请求超时。请重试。";
    }
    throw new Error(`${errorMessage}`);
  }
}

export const closeBrowser = (curBrowser, curPage) => {
  if (curBrowser) {
    curBrowser.close();
    curBrowser = null;
    curPage.off("request");
    curPage = null;
  }
};
