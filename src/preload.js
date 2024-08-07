const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  ipcRendererOn: (...args) => ipcRenderer.on(...args),
  ipcRendererOff: (...args) => ipcRenderer.removeAllListeners(args),
  fetchFiles: (url) => ipcRenderer.invoke("fetch-files", url),
  downloadFiles: (data) => ipcRenderer.invoke("download-files", data),
  downloadFile: (data) => ipcRenderer.invoke("download-file", data),
  onDownloadProgress: (callback) =>
    ipcRenderer.on("download-progress", (event, message) => {
      const data = JSON.parse(message);
      callback(data.src, data.progress);
    }),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getDefaultSavePath: () => ipcRenderer.invoke("get-default-save-path"),
  clearCache: () => ipcRenderer.invoke("clear-cache"),
  checkDefaultDirectory: (filenames) =>
    ipcRenderer.invoke("check-default-directory", filenames),
  getDownloadRecords: () => ipcRenderer.invoke("get-download-records"),
  pathParse: (url) => ipcRenderer.invoke("path-parse", url),
  openFileLocation: (url, filePath) =>
    ipcRenderer.invoke("open-file-location", url, filePath),
  setConfig: (config) => ipcRenderer.invoke("set-config", config),
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateFile: (url) => ipcRenderer.invoke("update-file", url),
  closeBrowser: () => ipcRenderer.invoke("close-browser"),
  getCacheWebsitesKey: () => ipcRenderer.invoke("get-cache-websites-key"),
});
