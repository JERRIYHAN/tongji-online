# Canvas 接入说明

现有命令支持：本机学校认证、验证会话、查询活跃学生课程、查询单课程作业摘要、跨课程汇总截止时间。只使用 `https://canvas.tongji.edu.cn` 的当前身份。

按任务加载资料：定位全局/课程功能读 [完整导航](canvas-navigation.md)；查询作业要求、公告、课件、单元、文件或辨别评分/测验边界读 [读取流程](canvas-workflows.md)。已有命令覆盖摘要查询，其他功能按网页流程继续读取。

## 登录

入口为学校 `/login`，按正常流程跳转统一认证。当前桌面页面同时显示微信扫码（`#tab12Con #wx_QRImage`）和密码区域（`#tab1Con`）；工具只滚动到偏好区域，不注入学校脚本、不修改认证参数、不读取密码输入值、不保存或导出二维码。

会话验证使用 `GET /api/v1/users/self/profile`，只对外返回 authenticated 布尔值，不返回用户资料。不是以“存在 Cookie”或“窗口关闭”作为登录成功标准。

登录打开隔离的临时浏览器上下文，不加载日常浏览器配置。按当前允许的学校域名单保存最小学校会话，保留其他已接入服务的认证，不导出日常 Chrome 的个人配置。所有命令使用同一私有 `TONGJI_ONLINE_HOME`，配置方法见主文档。

这是普通 JSON 会话文件：目录 0700、文件 0600，未使用系统钥匙串加密。Windows 的文件模式位不能代替访问控制列表，应使用本人私有的系统应用数据目录。不要放在 Git 仓库、共享目录或云同步目录。系统备份行为需用户自行控制。

## 只读 API

- 课程：`GET /api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=term&per_page=100`。
- 作业：`GET /api/v1/courses/:id/assignments?per_page=100&include[]=submission&override_assignment_dates=true`。
- 分页：读取 `Link: ...; rel="next"`，限相同 HTTPS 域名、相同资源路径及允许的查询参数。最多 10 页，超过就明确失败，不静默截断。
- 跨课程截止查询最多访问 30 门活跃学生课程，逐个读取；任何一门查询失败则整次操作失败，不把部分结果伪装成完整结果。
- 现有命令不接受用户任意 URL，不跟随 API 重定向，不请求或输出成绩。当前只读接口仅使用 GET。扩展读取按当前官网确认路径，可使用浏览器或独立辅助程序。

作业查询显式要求应用当前用户的截止时间覆盖设置；仅保留 ID、名称、截止时间、提交布尔状态和构建的校园链接，不返回提交内容、得分、个人资料或网页正文。

## 错误判断

| 错误代码 | 意义与操作 |
|---|---|
| LOGIN_REQUIRED | 缺少会话、401 或 API 认证重定向。先用 `auth login` 尝试复用学校认证，页面要求时再请本人扫码。 |
| LOGIN_TIMEOUT / LOGIN_CANCELLED | 未完成认证，不能宣布登录成功。 |
| BROWSER_FAILED | Chrome 启动失败。按主文档和宿主权限处理；实际无法启动时才转本人终端，不反复重试。 |
| SESSION_BUSY | 等待前一进程结束。异常中断遗留锁时先确认没有该工具进程，再处理锁。 |
| SESSION_STALE | 上一进程已不存在；确认本工具已退出后删除会话目录里的 operation.lock，不要删除 session.json。 |
| PERMISSION_DENIED | 403，核对学校页面权限。 |
| RATE_LIMITED | 429，立即停止。 |
| PAGE_CHANGED | JSON 格式、必要字段或时间格式发生变化，不能替换成空列表。 |
| UNSAFE_RESPONSE | API 或分页指向不允许的地址，已阻止访问。 |
| RESULT_TOO_LARGE | 超过读取上限，缩小范围。 |

本机清除会话不是服务端撤销。如凭据已经泄露，应使用学校提供的会话管理或退出功能；不要承诺删除本地文件能使其他副本失效。


资料：[Canvas 课程 API](https://developerdocs.instructure.com/services/canvas/resources/courses)、[作业 API](https://developerdocs.instructure.com/services/canvas/resources/assignments)、[分页规则](https://developerdocs.instructure.com/services/canvas/basics/file.pagination)。
