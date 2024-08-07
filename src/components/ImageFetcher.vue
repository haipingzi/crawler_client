<template>
  <div class="container">
    <div class="toolbar">
      <div class="t-main">
        <el-select
          v-model="url"
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          style="width: 300px; margin-right: 10px"
          placeholder="输入或者选择网址"
          clearable
        >
          <el-option
            v-for="item in websitesKey"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-button type="primary" @click="fetchFiles" :loading="loading">
          获取资源
        </el-button>
      </div>

      <el-dropdown :hide-on-click="false" trigger="click">
        <template #default>
          <el-button type="primary" class="ml-3">
            设置<i class="el-icon-arrow-down el-icon--right"></i>
          </el-button>
        </template>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-button type="warning" @click="clearCache"
                  >清除缓存</el-button
                >
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-switch
                  v-model="config.showBrowser"
                  inline-prompt
                  active-text="显示浏览器"
                  inactive-text="不显示浏览器"
                />
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-switch
                  v-model="config.loadMore"
                  inline-prompt
                  active-text="自动加载更多"
                  inactive-text="不自动加载更多"
                />
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-switch
                  v-model="config.autoCloseBrowser"
                  inline-prompt
                  active-text="自动关闭浏览器"
                  inactive-text="不自动关闭浏览器"
                />
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-switch
                  v-model="config.useProxy"
                  inline-prompt
                  active-text="使用代理"
                  inactive-text="不使用代理"
                />
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-tag
                  v-if="config.proxyAddress"
                  type="primary"
                  style="margin-right: 10px"
                  >{{ config.proxyAddress }}</el-tag
                >
                <el-button @click="openProxyModal">{{
                  config.proxyAddress ? "修改代理地址" : "添加代理地址"
                }}</el-button>
              </div>
            </el-dropdown-item>
            <el-dropdown-item>
              <div class="dropdown-item">
                <el-checkbox-group v-model="config.supportedFileTypes">
                  <el-checkbox label="图片" value="image" />
                  <el-checkbox label="视频" value="video" />
                </el-checkbox-group>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <el-progress
      v-if="overallProgress > 0"
      :percentage="overallProgress"
      class="progress-bar"
    ></el-progress>
    <div class="content">
      <el-table
        ref="multipleTableRef"
        :data="files"
        style="width: 100%"
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55"></el-table-column>
        <el-table-column prop="thumbnail" align="center" label="资源预览">
          <template #default="scope">
            <img
              v-if="scope.row.type === 'image'"
              :src="scope.row.url"
              class="thumbnail"
            />
            <video
              v-else-if="scope.row.type === 'video'"
              class="media-video"
              controls
              :key="scope.row.url"
              name="media"
            >
              <source :src="scope.row.url" type="video/mp4" />
            </video>
          </template>
        </el-table-column>
        <el-table-column prop="src" label="资源路径">
          <template #default="scope">
            <a @click="downloadFile(scope.row)" class="down-a">{{
              scope.row.url
            }}</a>
            <el-progress
              v-if="progress[scope.row.url]"
              :percentage="progress[scope.row.url]"
              class="single-file-progress"
            ></el-progress>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="文件名（双击重命名）" width="200">
          <template #default="scope">
            <RenameInput
              v-model="scope.row.name"
              placeholder="请双击重命名"
              :ext="scope.row.ext"
            />
          </template>
        </el-table-column>
        <el-table-column label="下载记录">
          <template #default="scope">
            <div
              class="download-record-item"
              v-for="record in downloadRecords[scope.row.url] || []"
              :key="record.fileName"
              :title="record.path"
            >
              <span class="record-path">
                {{ record.path }}
              </span>
              <el-button
                type="primary"
                @click="openDirectory(scope.row.url, record.path)"
                >打开</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="download-bar" v-if="selectedFiles.length > 0">
      <div>
        已选择<span style="color: #409eff">{{ selectedFiles.length }}</span
        >个资源
      </div>
      <el-button type="success" class="download-button" @click="downloadFiles"
        >下载选中资源</el-button
      >
    </div>
    <el-dialog
      title="输入代理地址"
      v-model="proxyDialogVisible"
      width="30%"
      @close="closeProxyModal"
    >
      <el-input
        v-model="config.proxyAddress"
        placeholder="输入代理地址"
      ></el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeProxyModal">取消</el-button>
          <el-button type="primary" @click="closeProxyModal">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { getErrorStr } from "@/utils";
import RenameInput from "./RenameInput.vue";

const errorfn = ElMessage.error;
ElMessage.error = (mes, ...rest) => {
  if (typeof mes === "string") {
    errorfn(getErrorStr(mes), ...rest);
  } else {
    errorfn(mes, ...rest);
  }
};

export default {
  components: {
    RenameInput,
  },
  setup() {
    const url = ref();
    const files = ref([]);
    const selectedFiles = ref([]);
    const loading = ref(false);
    const progress = ref({});
    const overallProgress = ref(0);
    const downloadRecords = ref({});
    const proxyDialogVisible = ref(false);
    const websitesKey = ref([]);
    const multipleTableRef = ref();
    const config = reactive({
      showBrowser: false,
      loadMore: false,
      autoCloseBrowser: true,
      proxyAddress: "",
      useProxy: false,
      supportedFileTypes: ["image", "video"],
    });

    onMounted(() => {
      loadDownloadRecords();
      getConfig();
      initCheWebsites();
    });

    watch(
      config,
      (val) => {
        window.electron.setConfig(JSON.stringify(val));
      },
      { deep: true }
    );

    const fetchFiles = async () => {
      if (!url.value) {
        ElMessage.error("请输入网址");
        return;
      }
      console.log(111);
      loading.value = true;
      try {
        onFileRes();
        files.value = await window.electron.updateFile(url.value);
        console.log(files.value);
        await window.electron.fetchFiles(url.value);
      } catch (err) {
        console.log(err);
        ElMessage.error(err.message || "获取网站图片失败");
      } finally {
        loading.value = false;
      }
    };

    const ononFileResCallback = (evt, item) => {
      files.value.push(item);
      console.log("ononFileResCallback", files.value);
      getCacheWebsitesKey();
    };

    const onFileRes = () => {
      console.log("onFileRes");
      window.electron.ipcRendererOff("file-url");
      window.electron.ipcRendererOn("file-url", ononFileResCallback);
    };

    const handleSelectionChange = (val) => {
      selectedFiles.value = val;
    };

    const downloadFiles = async () => {
      try {
        progress.value = {};
        overallProgress.value = 0;

        _onProgress();
        await window.electron.downloadFiles(
          JSON.stringify({
            files: selectedFiles.value,
          })
        );

        loadDownloadRecords();

        ElMessage.success("下载完成！");
        _resetData();
      } catch (err) {
        ElMessage.error(err.message || "下载失败");
        console.error("下载失败:", err.message);
      }
    };

    const _onProgress = (isSingle = false) => {
      window.electron.ipcRendererOn(
        "download-progress",
        (evt, { progress: p, src }) => {
          if (!progress.value) {
            progress.value = {};
          }
          progress.value[src] = p;
          if (!isSingle) {
            const totalFiles = selectedFiles.value.length;
            overallProgress.value =
              Object.values(progress.value).reduce((a, b) => a + b, 0) /
              totalFiles;
          }
        }
      );
    };

    const _resetData = (url) => {
      setTimeout(() => {
        if (!url) {
          progress.value = {};
          overallProgress.value = 0;
          selectedFiles.value = [];
          multipleTableRef.value.clearSelection();
        } else {
          progress.value[url] = null;
        }
      }, 2000);
    };

    const downloadFile = async (row) => {
      try {
        _onProgress(true);
        await window.electron.downloadFile(
          JSON.stringify({
            file: row,
          })
        );

        loadDownloadRecords();
        _resetData(row.url);
        ElMessage.success("文件下载成功");
      } catch (err) {
        ElMessage.error(err.message || "下载失败");
        console.error("下载失败:", err.message);
      }
    };

    const clearCache = async () => {
      try {
        await window.electron.clearCache();
        ElMessage.success("缓存已清除！");
      } catch (err) {
        ElMessage.error("清除缓存失败");
        console.error("清除缓存失败:", err);
      }
    };

    const openDirectory = async (imageUrl, filePath) => {
      try {
        // 如果打开的地址文件已经被删除 需要取删除这条记录
        const res = await window.electron.openFileLocation(imageUrl, filePath);
        if (!res.suc) {
          // 跟新下载记录
          loadDownloadRecords();
          ElMessage.error("文件不存在，已删除当前记录");
          return;
        }
        ElMessage.success(res.message);
      } catch (err) {
        ElMessage.error(err.message);
        console.error("打开目录失败:", err);
      }
    };
    // const removeDownloadRecords=()=>{

    // }

    const loadDownloadRecords = async () => {
      downloadRecords.value = await window.electron.getDownloadRecords();
    };

    const enableEditing = (row) => {
      row.isEditing = true;
    };

    const openProxyModal = () => {
      proxyDialogVisible.value = true;
    };
    const closeProxyModal = () => {
      proxyDialogVisible.value = true;
    };
    const getConfig = async () => {
      const savedConfig = await window.electron.getConfig();
      Object.assign(config, savedConfig);
    };

    const getCacheWebsitesKey = async () => {
      websitesKey.value = await window.electron.getCacheWebsitesKey();
    };
    const initCheWebsites = async () => {
      await getCacheWebsitesKey();

      if (websitesKey.value) {
        const len = websitesKey.value.length;
        if (len > 0) {
          url.value = websitesKey.value[len - 1];
          const downloadFiles = await window.electron.updateFile(url.value);
          files.value = downloadFiles;
        }
      }
    };
    return {
      url,
      files,
      selectedFiles,
      loading,
      progress,
      overallProgress,
      downloadRecords,
      proxyDialogVisible,
      config,
      fetchFiles,
      handleSelectionChange,
      downloadFiles,
      downloadFile,
      clearCache,
      openDirectory,
      loadDownloadRecords,
      enableEditing,
      openProxyModal,
      closeProxyModal,
      websitesKey,
      multipleTableRef,
    };
  },
};
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: #fff;
  box-sizing: border-box;
  z-index: 1000;
  padding: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.t-main {
  display: flex;
  align-self: center;
  flex: 1;
  margin-right: 10px;
}

.t-input {
  width: 300px;
  margin-right: 10px;
}

.progress-bar {
  position: fixed;
  top: 50px;
  left: 0;
  width: 100%;
  z-index: 1000;
  color: aquamarine;
}

.content {
  flex: 1;
  margin-top: 30px;
  overflow-y: auto;
  padding-top: 20px;
  padding-bottom: 60px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.download-bar {
  height: 60px;
  width: 100%;
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 99;
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  border-top: 1px solid #eee;
  box-sizing: border-box;
}

.thumbnail {
  width: 200px;
  max-height: 400px;
}
.media-video {
  width: 300px;
  max-height: 400px;
}
.down-a {
  cursor: pointer;
  color: #409eff;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; /* 显示的行数，可以根据需要修改 */
  overflow: hidden;
  text-overflow: ellipsis;
}
.filename-input .el-input__wrapper {
  box-shadow: 0 0 0 2px #0f0 inset;
}
.download-record-item {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.download-record-item > .record-path {
  margin-right: 10px;
  flex: 1;
  /* overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis; */
  display: flex;
  flex-wrap: wrap;
  word-break: break-all;
}
</style>
