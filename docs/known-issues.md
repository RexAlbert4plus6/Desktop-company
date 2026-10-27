# 待排查问题

## DC-003 · Samuel 人设与问候反复显示缺失（2026-10-27）

本次检查时，持久化设置中仍有 Samuel 的 9,390 字人设、15 条问候和完整素材；未发现原图被删除的证据。用户桌面的旧 Desktop-company 快捷方式不存在，项目内链接仍指向 v0.9.0。

确认并修复的保存 / 恢复缺陷：

- v1 角色包只保存名字、人设及互动类型，遗漏问候；导入也没有接回问候。
- 旧加载逻辑把“槽位有名字和文字”当成完整资料，未逐项修复缺失问候或占位人设。
- 设置保存没有校验所属槽位，快速切换时的旧表单存在覆盖当前角色的风险。
- 恢复后的登记没有立即落盘，且内置素材会依赖某个版本的安装目录。

v0.9.1 使用带问候的完整角色包，保留上一份卡片快照、逐项恢复、立即保存登记，并拦截旧槽位表单。已有图片迁入稳定的用户数据目录；本机安装包另有完整 Samuel 备份。设置顶部显示人设字数和问候条数，并提供直达按钮。

真实数据已备份；正式程序连续重启验证了完整表单、角色切换、图片和问候。新桌面链接为 Desktop-company（Samuel修复版）.lnk，已从独立进程核对目标并实际启动。上述缺陷可通过回归测试复现；无法仅凭本次现存文件确定每次历史异常的具体触发顺序。

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
