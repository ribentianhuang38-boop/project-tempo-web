// api/tarrt.js
import crypto from 'crypto';

export default async function handler(req, res) {
  // 限制只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "仅支持 POST 请求" });
  }

  // 获取前端传来的参数，包括是否要求流式 (前端刚才修改为传了 stream: true)
  const { prompt, stream = true } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "缺少指引" });
  }

  // 你要求的直接硬编码 API Key（再次提醒：生产环境请使用 process.env 保护私钥）
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
        // 开启流式传输
        stream: stream 
      })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "大模型请求失败");
    }

    // 如果前端明确要求不使用流式传输，则退回原本的整体返回逻辑 (兜底保护)
    if (!stream) {
        const data = await response.json();
        return res.status(200).json(data);
    }

    // ==========================================
    // 🌟 核心修改：流式传输 (SSE) 实时透传逻辑 🌟
    // ==========================================
    
    // 设置 Server-Sent Events 响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // no-transform 极其重要，防止 Vercel/Nginx 等中间件缓存流数据导致打字机效果失效
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // 刷新 Headers，告诉浏览器准备好接数据了
    if (res.flushHeaders) {
        res.flushHeaders();
    }

    // 获取响应体的可读流读取器
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    // 不断读取数据块并写入客户端响应
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
            res.end(); // 读取完毕，关闭流
            break;
        }
        
        // 将 Uint8Array 解码为字符串并写入
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
    }

  } catch (error) {
    console.error("请求失败:", error.message);
    
    // 异常处理：如果头信息还没发出去，就返回标准的 500 JSON
    if (!res.headersSent) {
        return res.status(500).json({ error: "星象连接失败", detail: error.message });
    } else {
        // 如果已经开始流传输了才断开，就只能直接强制结束响应了
        res.end();
    }
  }
}
