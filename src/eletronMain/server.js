import express from "express";
import axios from "axios";
import { openBrowser, onResponse } from "./index";

const app = express();
const PORT = 3000;

app.use("/proxy", async (req, res) => {
  try {
    const targetUrl = req.query.target;
    console.log("targetUrl", targetUrl);
    if (!targetUrl) {
      return res.status(400).send("Target URL is required");
    }
    const response = await axios.get(targetUrl, { responseType: "stream" });
    response.data.pipe(res);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).send("Error fetching file");
  }
});

app.get("/getVideoUrl", async (req, res) => {
  const targetUrl = req.query.target;
  console.log("targetUrl", targetUrl);
  if (!targetUrl) {
    return res.status(400).send("Target URL is required");
  }
  const urlPattern = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;
  const matchs = targetUrl.match(urlPattern);
  if (!matchs || !matchs[0]) {
    return res.status(400).send("Target URL is required");
  }
  const [pageUrl] = matchs;

  await openBrowser(
    pageUrl,
    {
      onResponse,
    },
    (suc, item) => {
      if (suc) {
        res.json({
          data: item,
          suc: true,
        });
      } else {
        res.json({
          mes: "获取视频失败",
          suc: false,
        });
      }
      console.log("openBrowser", item);
    }
  );
});

export function startServer() {
  app.listen(PORT, () => {
    console.log(`Proxy server is running on http://localhost:${PORT}`);
  });
}
