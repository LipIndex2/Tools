// const axios = require("axios");

// app.post("/webhook", async (req, res) => {
//   const data = req.body;

//   if (data.msgtype === "text") {
//     const userMsg = data.text.content;

//     // 调用企业微信机器人接口回复消息
//     const webhookUrl =
//       "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_webhook_key";
//     const reply = {
//       msgtype: "text",
//       text: {
//         content: `你发送了: ${userMsg}`,
//       },
//     };

//     try {
//       await axios.post(webhookUrl, reply);
//       console.log("自动回复已发送:", reply.text.content);
//     } catch (err) {
//       console.error("发送失败:", err.message);
//     }

//     res.status(200).send("OK");
//   } else {
//     res.status(400).send("Unsupported message type");
//   }
// });

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
import chxsdk from "./chxSdk/chx_sdk.v3.min.js";
let params = {
  game: "sxdwswx",
  platform: "wechat",
  apiSecretId: "6AFW6X35rVva",
  apiSecretKey: "yuFyY5OjI2fMMZrWqU4U",
  sandbox: false,
  gameVersion: "v18.11.2",
  query: option.query,
  scene: option.scene,
  packageName: "com.wechat.sxdwswx",
};
chxsdk
  .init(params)
  .then(function (result) {
    console.log("chxsdk.init:", result);
    // 初心sdk登录
    chxsdk
      .serverLogin()
      .then(function (result) {
        console.log("chxsdk.serverLogin:", result);
        var cxdata = result.data.data;
        //   {
        //     //1000表示成功
        //     code: 1000,
        //     data: {
        //         data: "{"game":"test","platform":"wechat","time":16226358…er_code\":\"093Wcjml2H2m774dB4ol2rA7EH1WcjmY\"}"}"
        //     },
        //     msg: "ok"
        // }
        if (cxdata.code !== 1000) {
          // sdk登录失败，2秒后重试
          console.log("sdk登录失败，2秒后重试");
          setTimeout(() => {
            chxsdk.serverLogin();
          }, 2000);
        } else {
          // sdk登录成功，设置用户基础数据
          console.log("sdk登录成功，设置用户基础数据");

          // 走心哥的服务器登录
          GameAllDataManager.Ins.Login(cxdata).then((platformAccount) => {
            console.log("平台账号", platformAccount);

            // 设置玩家登录数据
            if (platformAccount) {
              // 设置玩家登录数据
              let params = {
                uid: platformAccount.account,
                openid: platformAccount.openid,
                sessionKey: JSON.parse(platformAccount.extra).sessionKey,
              };
              chxsdk
                .setUserInfo(params)
                .then(function (result) {
                  console.log("chxsdk.setUserInfo:", result);

                  // 上报活跃
                  SdkCtrl.Ins.reportActive();
                })
                .catch(function (result) {
                  console.error("chxsdk.setUserInfo:", result);
                });
            }
          });
        }
      })
      .catch(function (result) {
        console.error("chxsdk.serverLogin:", result);
      });
  })
  .catch(function (result) {
    console.error("chxsdk.init:", result);
  });
