# 待排查问题

## DC-001 · 主进程 EPIPE 弹窗

- 记录日期：2026-10-20（Europe/London）。
- 报告版本：Desktop-company v0.8.0；用户表示此前也出现过类似弹窗。
- 状态：已记录，尚未复现或修复；作为后续稳定性优化跟进。
- 现象：系统弹出 “A JavaScript error occurred in the main process”，显示未捕获异常 `Error: EPIPE: broken pipe, write`。
- 触发时的具体操作、是否影响后续聊天及发生频率：待确认。

截图中的堆栈：

```text
Uncaught Exception:
Error: EPIPE: broken pipe, write
    at Socket._write (node:internal/net:75:18)
    at writeOrBuffer (node:internal/streams/writable:574:12)
    at _write (node:internal/streams/writable:503:10)
    at Writable.write (node:internal/streams/writable:512:10)
    at [kWriteToConsole] (node:internal/console/constructor:311:16)
    at console.error (node:internal/console/constructor:442:26)
    at replyWithError (node:electron/js2c/browser_init:1:119530)
    at Session.<anonymous> (node:electron/js2c/browser_init:1:120046)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

初步判断（尚未确认）：堆栈显示 Electron 在报告另一个错误时调用 `console.error`，向已断开的输出管道写入又引发 EPIPE。可能涉及启动程序的终端 / 父进程退出后，标准输出或错误输出管道被关闭；也可能存在被这次日志异常遮住的原始错误。不能仅凭此图把根因归为 API、杀毒软件或某一条应用代码。

后续优化：

1. 复现从桌面快捷方式、终端与后台启动器启动，以及启动器关闭后的错误路径。
2. 排查 Electron IPC / Session 错误上报，捕获被遮住的第一条异常。
3. 为标准输出 / 错误输出增加明确的断管处理；仅处理已识别的 EPIPE，不吞掉其他异常。
4. 建立有大小限制的本地错误日志，记录时间、版本、错误码及堆栈；不记录密钥、请求头、聊天正文或人设。
5. 验证 API 失败仍能返回可读提示，用户取消与关闭窗口不弹主进程异常。

原始截图另存于本机私有目录 `private/bug-reports/DC-001-main-process-epipe.png`，不放入公开源码。

## DC-002 · 安全软件联网控制可能影响 API 连接

- 记录日期：2026-10-20（Europe/London）。
- 现象：点击连接测试显示“无法连接服务商”。
- 本次排查：已保存的 DeepSeek 配置完成过真实短请求并返回 HTTP 200 / OK；桌宠 exe 的无密钥网络探测能收到服务端 HTTP 401，说明探测当时可达。未发现针对该程序的 Windows 防火墙应用规则。
- 用户反馈：关闭杀毒软件的联网控制后“似乎可以了”。据此怀疑与该功能有关，尚无具体安全软件拦截日志证实；不将关闭安全防护作为产品解决方案。
- 后续优化：网络错误提示区分连接、DNS、TLS、超时等原因，并提示查看安全软件中该程序的联网权限。与 DC-001 分开跟踪，不默认两者具有同一根因。
