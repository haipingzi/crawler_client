"use strict";

import { app, protocol, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";
import path from "path";
import fs from "fs";
import {
  ensureUniqueFilePath,
  downloadRecords,
  instance,
  store,
  defaultDownloadPath,
  addDownloadRecords,
  removeDownloadRecord,
  saveCacheWebsite,
  cacheWebsites,
  openBrowser,
  onResponse,
  loadCacheWebsite,
} from "@/eletronMain";
// import { startServer } from "@/eletronMain/server";

const isDevelopment = process.env.NODE_ENV !== "production";

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  global.mainWindow = win;
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    win.loadURL("app://./index.html");
  }
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  loadCacheWebsite();
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  createWindow();
  // startServer();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}

ipcMain.handle("fetch-files", async (event, pageUrl) => {
  await openBrowser(pageUrl, { onResponse });
});
ipcMain.handle("download-files", async (event, data) => {
  const parseData = JSON.parse(data);
  if (!data) return;
  const { files } = parseData;
  const saveDirectory = await getSaveDirectory();
  if (!fs.existsSync(saveDirectory)) {
    fs.mkdirSync(saveDirectory, { recursive: true });
  }
  try {
    fs.accessSync(saveDirectory, fs.constants.W_OK);
  } catch (err) {
    throw new Error("没有写入选定目录的权限");
  }
  const downloadPromises = files.map((item) => {
    const { url: src, name, ext } = item;
    const fileName = `${name}${ext}`;
    const basename = fileName || path.basename(new URL(src).pathname);
    const savePath = ensureUniqueFilePath(path.join(saveDirectory, basename));

    return downloadFile(event, src, savePath);
  });
  await Promise.race(downloadPromises);
});

ipcMain.handle("download-file", async (event, data) => {
  const { file } = JSON.parse(data);
  const savePath = await getSavePath(file.url, `${file.name}${file.ext}`);
  return downloadFile(event, file.url, savePath);
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

ipcMain.handle("get-default-save-path", () => {
  return defaultDownloadPath;
});

ipcMain.handle("clear-cache", () => {
  saveCacheWebsite({});
});
ipcMain.handle("check-default-directory", (event, filePaths) => {
  const parseFilePaths = JSON.parse(filePaths);
  if (!fs.existsSync(defaultDownloadPath)) {
    fs.mkdirSync(defaultDownloadPath, { recursive: true });
  }
  const existFiles = [];
  const downFilePaths = [];
  parseFilePaths.forEach((url) => {
    const filename = url.split("/").pop();
    const downFilePath = path.join(defaultDownloadPath, filename);
    if (fs.existsSync(downFilePath)) {
      existFiles.push(url);
      downFilePaths.push(downFilePath);
    }
  });
  return [existFiles, downFilePaths];
});

const getSaveDirectory = async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    defaultPath: defaultDownloadPath,
  });
  if (result.canceled) {
    throw new Error("未选择保存路径");
  } else {
    return result.filePaths[0];
  }
};

const getSavePath = async (url, fileName) => {
  const basename = fileName || path.basename(new URL(url).pathname);
  const saveDirectory = await getSaveDirectory();
  if (!fs.existsSync(saveDirectory)) {
    fs.mkdirSync(saveDirectory, { recursive: true });
  }
  try {
    fs.accessSync(saveDirectory, fs.constants.W_OK);
  } catch (err) {
    throw new Error("没有写入选定目录的权限");
  }
  return ensureUniqueFilePath(path.join(saveDirectory, basename));
};

async function downloadFile(event, url, savePath) {
  if (url.startsWith("data:image/")) {
    // 处理Base64编码的图片
    const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      const data = matches[2];
      const buffer = Buffer.from(data, "base64");

      fs.writeFileSync(savePath, buffer);
      event.sender.send("download-progress", { src: url, progress: 100 });
      addDownloadRecords(url, savePath);
      console.log(`Downloaded base64 image: ${savePath}`);
      return;
    } else {
      console.error("Invalid Base64 image URL");
      return;
    }
  }
  const response = await instance.get(url, { responseType: "stream" });

  const totalLength = parseInt(response.headers["content-length"], 10);

  return new Promise((resolve, reject) => {
    let downloadedLength = 0;
    const writer = fs.createWriteStream(savePath);
    response.data.pipe(writer);
    response.data.on("data", (chunk) => {
      downloadedLength += chunk.length;
      const progress = Math.round((downloadedLength / totalLength) * 100);
      event.sender.send("download-progress", { src: url, progress });
    });
    writer.on("finish", () => {
      addDownloadRecords(url, savePath);
      resolve();
    });
    writer.on("error", reject);
  });
}

ipcMain.handle("get-download-records", () => {
  return downloadRecords || [];
});
ipcMain.handle("path-parse", (event, url) => {
  return path.parse(url);
});
ipcMain.handle("set-config", (event, config) => {
  const parseConfig = JSON.parse(config);

  const configData = store.get("config");

  store.set("config", { ...configData, ...parseConfig });
});

ipcMain.handle("close-browser", () => {
  // closeBrowser();
});

ipcMain.handle("update-file", async (event, url) => {
  // if (curPage) {
  //   const files = await getFiles(curPage);
  //   _normoniseFiles(files, url);
  // }
  console.log("cacheWebsites", cacheWebsites);
  return cacheWebsites[url] || [];
});

ipcMain.handle("open-file-location", async (event, url, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      removeDownloadRecord(url, filePath);
      return { suc: false, message: "文件不存在" };
    }
    await shell.showItemInFolder(filePath);
    return { suc: true, message: "文件打开成功" };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
});

ipcMain.handle("set-proxy", (event, proxyAddress) => {
  const config = store.get("config");
  store.set("config", { ...config, proxyAddress });
});

ipcMain.handle("get-config", () => {
  return store.get("config");
});
ipcMain.handle("get-cache-websites-key", () => {
  console.log("cacheWebsites", Object.keys(cacheWebsites));
  return Object.keys(cacheWebsites) || [];
});
