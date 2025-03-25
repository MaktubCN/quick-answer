# 快答 (Quick Answer)

一个简单的Web APP，用于快速回答问题。用户点击开始后开始录音，然后再次点击后停止录音，最后点击提交，系统会将录音上传到服务器，然后使用Whisper API将录音转换为文本，最后使用gpt-4o模型进行回答。

## 功能特点

- 语音录制
- 实时转写
- AI智能回答
- 流式输出
- 简洁的ChatGPT风格界面

## 技术栈

- Next.js 14
- TypeScript
- Tailwind CSS
- WebSocket (用于流式输出)

## 开始使用

1. 安装依赖：

```bash
npm install
```

2. 运行开发服务器：

```bash
npm run dev
```

3. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 使用方法

1. 点击"开始录音"按钮开始录制
2. 再次点击按钮停止录音
3. 点击"提交"按钮上传录音并获取AI回答
4. 等待系统处理并查看回答

## 使用说明

通过URL参数配置API：

`?base_url=你的API地址&api_key=你的API密钥`

示例：
`http://localhost:3000/?base_url=https://api.example.com&api_key=your_api_key`

注意事项：
- API密钥仅限测试使用，请勿暴露在客户端
- 生产环境建议使用服务端代理
## 注意事项

- 使用前请确保浏览器支持录音功能
- 需要允许浏览器访问麦克风
- 建议使用现代浏览器以获得最佳体验