const axios = require("axios");

app.post("/webhook", async (req, res) => {
  const data = req.body;

  if (data.msgtype === "text") {
    const userMsg = data.text.content;

    // 调用企业微信机器人接口回复消息
    const webhookUrl =
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_webhook_key";
    const reply = {
      msgtype: "text",
      text: {
        content: `你发送了: ${userMsg}`,
      },
    };

    try {
      await axios.post(webhookUrl, reply);
      console.log("自动回复已发送:", reply.text.content);
    } catch (err) {
      console.error("发送失败:", err.message);
    }

    res.status(200).send("OK");
  } else {
    res.status(400).send("Unsupported message type");
  }
});


// # 切换到工作目录
// cd /Users/cxmacstudio01/Documents/Codes/XB || { echo "Project directory not found!"; exit 1; }

// # 确保分支存在
// if ! git ls-remote --heads origin ${BRANCH}; then
//     echo "Branch ${BRANCH} does not exist on the remote repository!"
//     exit 1
// fi

// # 清理并切换分支
// git reset --hard
// git clean -fd
// git fetch origin
// git checkout ${BRANCH} || { echo "Failed to checkout branch ${BRANCH}!"; exit 1; }
// git pull origin ${BRANCH} || { echo "Failed to pull branch ${BRANCH}!"; exit 1; }

// echo "Successfully switched to branch ${BRANCH}."