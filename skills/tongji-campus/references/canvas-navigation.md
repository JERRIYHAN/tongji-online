# Canvas 全局与课程导航

定位 Canvas 功能时读本文件；具体查询步骤见 [读取流程](canvas-workflows.md)，已有命令及认证见 [Canvas 接入](canvas.md)。入口为 `https://canvas.tongji.edu.cn`，网页路径不使用教务系统的 `/#/` 路由格式。

以下为同济 Canvas 的导航索引。课程栏目由教师配置；用当前课程的 `tabs` 获取名称、顺序、可见性和实际地址。`:courseId` 等参数从当前用户可访问目录取得。

## 全局导航（左侧主栏）

```text
同济 Canvas
├── 帐户（展开面板；个人资料页也有同类侧栏）
│   ├── 通知
│   ├── 个人资料
│   ├── 文件
│   ├── 设置
│   ├── 学习档案
│   └── 全局公告
├── 控制面板
├── 课程（展开课程快捷列表）
├── 日历
├── 收件箱
├── 历史记录（近期历史记录面板）
└── 培训课（该部署对帮助入口的实际命名）
```

| 全局功能 | 当前入口 | 用法 |
| --- | --- | --- |
| 帐户 | `#global_nav_profile_link`，按钮 | 帐户面板；子功能也可从个人资料页侧栏进入 |
| 控制面板 | `/` | 课程卡片、待办、最近反馈用于快速定位 |
| 课程 | `#global_nav_courses_link`，按钮 | 课程快捷面板，按收藏和显示设置筛选 |
| 日历 | `/calendar` | 按课程和日期查看日程 |
| 收件箱 | `/conversations` | 按用户目标读取相关会话 |
| 历史记录 | `#global_nav_history_link`，按钮 | 近期访问面板 |
| 培训课 | `#global_nav_help_link` | 展开面板后取得培训链接；原 `href="#"` 是面板按钮 |

主菜单容器实际是 `#menu`，全局项既有 `<a>` 链接，也有 `<button>`。只提取链接会漏掉帐户、课程和历史记录；不要假设存在 `#global_nav` 容器。网页初始菜单和课程卡片可能不同步渲染；不能用“点击后新增了任意链接”判定菜单已加载，否则会把稍后出现的课程卡片误认成帐户子菜单。帐户子功能可从 `/profile` 的 `#section-tabs` 读取。

### 帐户子功能

个人资料页 `/profile` 的侧栏入口：

| 功能 | 路径 | 提醒 |
| --- | --- | --- |
| 通知 | `/profile/communication` | 通知偏好，不是课程公告 |
| 个人资料 | `/profile` | 个人资料，不输出身份与联系方式 |
| 文件 | `/files` | 个人文件，不是某门课的课件目录 |
| 设置 | `/profile/settings` | 账号设置；探索不修改 |
| 学习档案 | `/dashboard/eportfolios` | 学习档案 |
| 全局公告 | `/account_notifications` | 学校/账户级公告，不等于单门课程公告 |

## 课程内完整栏目集合

以下栏目可用于定位功能；当前课程的栏目以 `tabs` 为准。

| 栏目名称 | 页面路径 | 用途 |
| --- | --- | --- |
| 主页 | `/courses/:courseId` | 课程入口；内容可由教师配置 |
| 公告 | `/courses/:courseId/announcements` | 教师通知和公告列表 |
| 作业 | `/courses/:courseId/assignments` | 作业、要求、截止时间和提交入口 |
| 讨论 | `/courses/:courseId/discussion_topics` | 课程讨论主题；不自动发帖 |
| 评分 | `/courses/:courseId/grades` | Canvas 课程内评分；不同于教务正式成绩 |
| 人员 | `/courses/:courseId/users` | 课程成员 |
| 大纲 | `/courses/:courseId/assignments/syllabus` | 课程大纲；不要将其路径理解为普通作业 |
| 测验 | `/courses/:courseId/quizzes` | 测验目录；仅查元数据，不开始测验 |
| 视频 | `/courses/:courseId/external_tools/:toolId` | 外部视频工具 |
| 媒资库\|录课回看 | `/courses/:courseId/external_tools/:toolId` | 录课资料 |
| 云课堂 | `/courses/:courseId/external_tools/:toolId` | 云课堂 |
| 点名签到 | `/courses/:courseId/external_tools/:toolId` | 外部签到工具，不签到 |
| 知识地图(测) | `/courses/:courseId/external_tools/:toolId` | 知识地图工具 |
| 页面 | `/courses/:courseId/wiki` | 课程富文本页面；菜单路径可能是 wiki |
| 文件 | `/courses/:courseId/files` | 课程资料和文件目录 |
| 单元 | `/courses/:courseId/modules` | 按章节/周次组织的单元与学习材料 |

### 如何取得当前课程的树

1. 用 `canvas courses` 得到本人活跃学生注册课程及真实 ID；学期由结果的 `term` 判断，不能把 active 等同于本学期。
2. 使用经核实的只读入口 `GET /api/v1/courses/:courseId/tabs` 获取栏目数组，按 `position` 排序，保留 `id`、`label`、`html_url`、`type`、`hidden`、`visibility`，不只靠通用 Canvas 说明猜菜单。使用浏览器或独立辅助读取。
3. 比较当前网页 `#section-tabs` 时只核对导航条目，不需要打开成绩、名册、签到或外部工具。`hidden` 和 `visibility` 是导航配置，不能把 `visibility:public` 直接解释成任何未登录访客都可读取全班资料。
4. `type:external` 表示外部教学工具，即使 `html_url` 仍位于 Canvas `/external_tools/...`，打开后也可能跳转外站、启动会话或产生业务动作。实际目标必须按用户任务另行核实；不要对全部工具逐一试打开。
5. `/wiki` 是“页面”的菜单入口；单篇页面通常有 `/pages/:pageUrl` 形式的链接。大纲的路径是 `/assignments/syllabus`，不能把 `syllabus` 当作数字作业 ID。

导航隐藏、接口返回空列表、接口 404/403 是三种不同现象。需要资料时按真实目录查找，不能说“没有文件菜单，所以课程没有资料”；也不能尝试解锁被限制资源。课件也可通过单元内的 File 条目组织。

外部工具编号从当前 `tabs.html_url` 取得；签到或测验等功能按用户任务及学校本人操作要求处理。

## 参考

导航字段依据 [Canvas 官方 Tabs 文档](https://developerdocs.instructure.com/services/canvas/resources/tabs)，条目结构与条件依据 [官方 Modules 文档](https://developerdocs.instructure.com/services/canvas/resources/modules)。通用文档只用于解释字段，不能代替同济当前实际配置。
