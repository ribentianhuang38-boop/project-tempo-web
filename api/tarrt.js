// api/tarrt.js
import crypto from 'crypto';

export default async function handler(req, res) {
  // 限制只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "仅支持 POST 请求" });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "缺少指引" });
  }

  // 你要求的直接硬编码 API Key（注意保护好私钥）
  const API_KEY = "e70b9c1e0c1c476cba55d890d77cf63e.8bBdZ1OUT5hjPvsM";

  // 智谱 API 鉴权 Token 生成逻辑
  const generateToken = (apikey) => {
    const [id, secret] = apikey.split('.');
    if (!id || !secret) {
        throw new Error("API Key 格式不正确");
    }
    const payload = {
      api_key: id,
      exp: Date.now() + 3600000, // 1小时后过期
      timestamp: Date.now()
    };
    const header = { alg: 'HS256', sign_type: 'SIGN' };

    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const head = encode(header);
    const pay = encode(payload);
    const signature = crypto.createHmac('sha256', secret).update(`${head}.${pay}`).digest('base64url');
    return `${head}.${pay}.${signature}`;
  };

  try {
    const token = generateToken(API_KEY);

    // 发起向智谱大模型的请求
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-4-flash", // 可以根据需要替换为 glm-4 等其他版本
        messages: [
          // 前端已经拼装了非常强大的人设 Prompt，这里作为系统底层保底
          { role: "system", content: "你是一个连接灵界的系统通道，请严格执行用户的设定指令。" },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "大模型请求失败");
    }

    const data = await response.json();
    
    // 直接将大模型的返回结果透传给前端
    return res.status(200).json(data);

  } catch (error) {
    console.error("请求失败:", error.message);
    return res.status(500).json({ error: "星象连接失败", detail: error.message });
  }
}