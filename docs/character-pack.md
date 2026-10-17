# 角色素材包

在软件的“设置 → 角色槽位”选择四个槽位之一。图片可拖进对应格子，或点击格子选文件。换图前会保存当前表单。PNG 不超过 20 MB，32～4096 像素；同一角色的图应使用相同画布和人物位置。

基本图片：Normal、Blink（闭眼）、Happy、Unhappy、Angry、Smile、Surprised。半闭眼、疑惑、嗤笑和坏笑可选。缺少闭眼图时不眨眼，缺少半闭眼时直接在睁眼和闭眼之间切换。

每个槽位独立保存名字、人设、图片、饰品状态、聊天、长期记忆和问候。用户信息、世界书、API 密钥、置顶与大小设置共享。更换人设不会自动清空历史；要清除时请在设置中操作聊天与记忆。

素材包结构：

```text
character.json
persona.txt
assets/
  normal.png
  blink-closed.png
  blink-half.png
  happy.png
  unhappy.png
  angry.png
  smile.png
  surprised.png
  confuse.png
  mock.png
  smirk.png
  ears.png
  scarf.png
  sweater.png
```

`character.json` 示例：

```json
{"version":1,"name":"Aster","persona":"一个爱看书、说话简短的角色，与 Creator 是平等的朋友。"}
```

程序旁提供 `character` 文件夹，可以保存导出的包；“打开 character 文件夹”打开当前槽位的实际本地存储。实际数据位于 `%APPDATA%\KairosDesktop\character\slot-1` 到 `slot-4`，更新程序不会替换它们。

导出的包只含图片和人设，不含密钥、用户信息、世界书、聊天或记忆。不要将自己的私人素材包混入公开源码。公开代码的 MIT 许可证不授予私人角色画作的使用权。
