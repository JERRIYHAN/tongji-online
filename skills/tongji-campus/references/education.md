# 本科教务课表

定位教务其他功能时先查 [完整菜单索引](education-navigation.md)，按当前账号的实际菜单进入，不根据前端全部路由猜测可见功能。

入口 `https://1.tongji.edu.cn`，课表页面 `/#/studentTimeTable`。CLI 只支持本人本科生课表，不提供成绩命令，不查他人课表，不选课或退课。本人实践完成情况和成绩另见 [实践成绩查询](education-practice.md)，使用已验证的官方页面流程。

## 认证

`auth login --service education` 从官方 `/api/ssoservice/system/loginIn` 进入统一认证，用户扫码或在学校页面手动输入账号密码。官方前端将登录后的 sessionStorage.sessionid 用作 X-Token；程序只在本地捕获这一项凭据，不保存整份 sessiondata 个人资料，也不向模型输出。会话文件仍为仅当前用户访问的本地文件，未使用系统钥匙串加密。

验证接口 GET `/api/sessionservice/session/getSessionUser` 在本地确认存在用户对象，对模型只返回认证状态。Canvas 或 IAM 会话有效，不等于教务 X-Token 仍有效。

## 查询

`education timetable [--term <学期ID>] [--week <1到60>] [--weekday <1到7>]`。

- GET `/api/baseresservice/schoolCalendar/currentTermCalendar?flag=0` 获取当前学期编号。
- GET `/api/electionservice/reportManagement/findStudentTimetab?calendarId=...` 查询当前身份的课表，不开放 studentCode/学号输入。
- 只返回课程名、课号、教学班号、教师、校区、地点、教学周、星期、起止节次；过滤学生身份、教师编码和会话数据。

周次是学校教学周，不是自然周；周一为 1，周日为 7。节次不等于钟点，不要将第 3–4 节说成 3:00–4:00。未提供日期对应的校历证据时，不推测今天是第几周，也不自动处理调休。没排课的课程保留 unscheduled 标记，不能说学生没选该课。

接口和字段来自当前官方前端 StuLessonTimeTableCpt/KikX 模块。401/403 或字段变化直接失败，不返回虚假的空课表。
