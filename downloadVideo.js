const axios = require("axios");
const fs = require("fs");
const path = require("path");

// 视频 URL 和保存路径
const videoUrl =
  "stodownload?encfilekey=Cvvj5Ix3eewK0tHtibORqcsqchXNh0Gf3sJcaYqC2rQAtiaEp2tc1IGaiblPcov3Ew75ib4XF9kWBAeN5t4nvO572hry3PUruZvxHBTibRVQxtwvY5Y5WRHHd5yu125Srib5k8&bizid=1023&dotrans=0&hy=SH&idx=1&m=&upid=0&web=1&token=cztXnd9GyrG1VltM91kNcz1BUZghKjic2Vj5HtySRh6vIc6jnvyPw8339uQIib0VYzXMlNrN8NsiaAngIPJKa31ibYiah24jPCwL4YUsoIUV1JNBoqUibofMDChuE4l2yKEMlN&ctsc=140&extg=10f0000&svrbypass=AAuL%2FQsFAAABAAAAAAAuTESgdSqpbZQczWl%2BZhAAAADnaHZTnGbFfAj9RgZXfw6VXr9gmtU0u%2BAc3Fo2%2BKN%2BU0L20qLYBeeHxGXKeQnewBzkUyGjrMj%2Fb7U%3D&svrnonce=1719560653&taskid=pc-1719560654098851525&fexam=1&X-snsvideoflag=xWT156"; // 替换为实际的视频 URL

const savePath = path.resolve(__dirname, "video1.mp4");

// 使用 Axios 下载视频
async function downloadVideo(url, savePath) {
  const writer = fs.createWriteStream(savePath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

downloadVideo(videoUrl, savePath)
  .then(() => {
    console.log("视频下载完成");
  })
  .catch((error) => {
    console.error("视频下载失败", error);
  });
