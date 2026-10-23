# 本科教务功能导航

适用：用户询问教务某项功能在哪里，或需要选定查询入口时，先查本文件；先按索引定位，需要更多信息时继续探索当前页面。本文件是功能位置索引，不是业务接口清单，也不代表对应功能已有 CLI 命令。

## 使用方式

站点：`https://1.tongji.edu.cn`。以下是本科生菜单索引，包含 20 个一级菜单、90 个末级功能。使用当前账号菜单刷新角色可见项；功能办理期和资格在目标页面查看。菜单刷新方法见文末。

## 常见需求先查这里

| 用户需求 | 菜单位置 | 当前菜单路由 |
| --- | --- | --- |
| 培养方案、课程类别要求 | 我的培养 → 我的培养方案 | `/myBclCultureScheme` |
| 培养计划、学分完成情况 | 我的培养 → 我的培养计划 | `/traningPlanMy` |
| 个人课程表 | 我的选课 → 个人课表 | `/GraduateStudentTimeTable` |
| 专业课表、全校课表 | 我的选课 → 专业课表／全校课表 | `/StudentMajorTimeTable`／`/taskResultQuery` |
| 课程教学进度 | 我的选课 → 教学进度查询 | `/auditProgressList` |
| 考试时间和地点 | 我的考试 → 我的考试 | `/StuExamEnquiries` |
| 选课网历史成绩 | 我的成绩 → 选课网我的成绩 | `/oldStysteMyGrades` |
| 社会实践完成情况和成绩 | 社会实践课 → 我的成绩 | `/inquiryResults` |
| 微辅修成绩 | 进阶式(微辅修) → 我的进阶式成绩 | `/myMinorScore` |
| 教学大纲 | 教学大纲 → 教学大纲查询 | `/undergraduateQuery` |
| 校历 | 消息通知 → 校历 | `/schoolCalendars` |
| 本人申请记录 | 消息通知 → 我的申请 | `/StudentRollCheck` |
| 创新创业课程认定记录 | 创新创业 → 对应认定分组 → 我的申请 | 校级 `/identificationApplication`，院级 `/abilityCourseApplication` |
| 毕业设计任务书、答辩安排 | 毕业设计 → 查看任务书／查看答辩安排 | `/taskView`／`/viewReplyArrangement` |

不要只用末级名称定位：“我的申请”“我的导师”“我的成绩”在不同分支可能重名，必须保留完整上级路径。进入目标页面后读取所需字段。

## 完整菜单树

以下保留实际菜单顺序和大小写。`/xxx` 是站内页面路由；已有认证后一般可通过 `https://1.tongji.edu.cn/#/xxx` 定位。分类节点即使带路由也可能只作为分组，不能据此认定点击行为。外部系统通过当前菜单提供的链接进入。

```text
├── 消息通知
│   ├── 帮助中心  → /helpCenter
│   ├── 消息中心（新）  → /MessageCenterNew
│   ├── 我的申请  → /StudentRollCheck
│   ├── 通知公告  → /myAnnouncement
│   ├── 校历  → /schoolCalendars
│   └── 下载历史  → /systemMessage
├── 资源管理
│   └── 教室使用情况报表  → /classroomUsageReport
├── 我的学籍
│   ├── 我的信息  → /StudentBaseInfo
│   ├── 下载学籍模板文件  → /modelFilesManage
│   └── 补办学生证  → /xszbb
├── 主修专业确认
│   ├── 学业成绩(百分制)排名  → /studentScoreRank
│   ├── 志愿填报  → /volunteerFilling
│   ├── 录取状态查询  → /enrollStatusQuery
│   ├── 类内面试考核安排查询  → /InterviewArrangeQuery
│   ├── 类内特色评测考核安排查询  → /featureArrangeQuery
│   ├── 类内综合成绩查询  → /interResultRankingNew
│   ├── 跨类面试考核安排查询  → /CrossInterviewArrangeQuery
│   ├── 跨类特色评测考核安排查询  → /crossFeatureArrangeQuery
│   └── 跨类录取确认  → /EnrollConfirm
├── 我的培养
│   ├── 我的培养方案  → /myBclCultureScheme
│   └── 我的培养计划  → /traningPlanMy
├── 我的选课
│   ├── 个人选课  → /studentElect
│   ├── 本研互选选课  → /BkElcMutualStudentElection
│   ├── 个人课表  → /GraduateStudentTimeTable
│   ├── 专业课表  → /StudentMajorTimeTable
│   ├── 全校课表  → /taskResultQuery
│   ├── 教学进度查询  → /auditProgressList
│   ├── 重修缴费  → /RetakeStuPay
│   ├── 期中退课  → /MidTermWithdrawalCourses
│   ├── 申请跨学科选课  → /CroElcMutualApply
│   └── 申请本研互选  → /BkElcMutualApply
├── 我的考试
│   ├── 我的考试  → /StuExamEnquiries
│   └── 申请重考  → /applyMakeupExam
├── 我的成绩
│   ├── 免听申请(新)  → /newEXLApply
│   ├── 免修申请  → /EXLApplication
│   ├── 选课网我的成绩  → /oldStysteMyGrades
│   ├── 申请校内学分认定  → /InSchoolCreditApplication
│   └── 申请校外学分认定  → /offCampusCreditApplication
├── 迎新
│   ├── 我的迎新任务  → /welcome
│   └── 我的入学考试信息  → /myExam
├── 我的导师
│   ├── 新生导师
│   │   ├── 新生见面会  → /schoolTutorMeeting
│   │   ├── 我的导师  → /mySchoolTutor
│   │   └── 申请导师  → /schoolTutorApply
│   ├── 学院导师
│   │   ├── 学院导师信息查询  → /collegeTutorMessage
│   │   ├── 我的导师  → /myCollegeTutor
│   │   └── 申请导师  → /collegeTutorApply
│   └── 互选导师
│       ├── 互选导师库查询  → /libraryQuery
│       ├── 申请互选导师  → /mutualApply
│       ├── 我的互选导师  → /myMutualTutor
│       ├── 导师指导记录  → /mutualTurorRecord
│       └── (学生新增)导师指导记录  → /tutorGuidMg
├── 我的语言强化班  → /StrengtheningClass
│   └── 语言强化班报名  → /scStudentRegistration
├── 教学大纲
│   └── 教学大纲查询  → /undergraduateQuery
├── 我的实习  → /practiceManagement
│   ├── 申请分散实习  → /dispersionPracticeApply
│   └── 申请实践重修  → /practiceReworkManagement
├── 竞赛及考试
│   ├── 普通话等级考试报名  → /studentsRegist
│   ├── 信息技术水平报名  → /computerStuRegistration
│   ├── 国家汉字应用水平考试报名  → /studentsRegistr
│   ├── 我的学科竞赛成绩  → /myCompetitionResults
│   ├── 竞赛报名  → /examinationRegistration
│   └── 我的竞赛成绩  → /myResults
├── 创新创业
│   ├── 竞赛目录查询  → /competitionAwards
│   ├── 申请成果记录
│   │   ├── 申请创新创业成果  → /resultApply
│   │   ├── 我的申请  → /resultApplication
│   │   └── 创新创业成果记录  → /resultRecord
│   ├── 申请校级课程认定
│   │   ├── 申请《创新创业实践》课程认定  → /curriculumIdentification
│   │   └── 我的申请  → /identificationApplication
│   └── 申请院级课程认定
│       ├── 申请《创新创业能力拓展项目》课程认定  → /abilityCourseApplyList
│       └── 我的申请  → /abilityCourseApplication
├── 对外交流
│   ├── 申请对外交流  → /UGIEExchangeApplication
│   └── 申请学分认定  → /UGIECreditApplication
├── 毕业设计
│   ├── 自拟课题申报  → /stuDeclareSubject
│   ├── 学生选题  → /studentTopic
│   ├── 查看任务书  → /taskView
│   ├── 申请课题变更  → /topicChange
│   ├── 提交开题报告  → /submitOpeningReport
│   ├── 提交中期检查  → /submitMidTermCheck
│   ├── 提交毕业设计（论文）  → /submitGraduationDesign
│   ├── 下载毕业设计相关文件  → /graduationDesignPrint
│   ├── 查看答辩安排  → /viewReplyArrangement
│   ├── 延期答辩申请  → /studentDefenceDelayApply
│   └── 上传归档材料  → /archiveMaterials
├── 进阶式(微辅修)
│   ├── 我的报名  → /mySign
│   ├── 进阶式选课缴费  → /minorStudentPay
│   └── 我的进阶式成绩  → /myMinorScore
├── 社会实践课
│   └── 我的成绩  → /inquiryResults
└── 外部系统
    ├── Canvas平台  → https://canvas.tongji.edu.cn/ [外部系统]
    ├── 云课堂教学系统  → https://courses.tongji.edu.cn/ [外部系统]
    ├── 智慧树SPOC  → https://ids.tongji.edu.cn:8443/nidp/oauth/nam/authz [外部系统] [参数已省略，须从官网菜单进入]
    └── 媒资库|录课回看  → https://look.tongji.edu.cn/ [外部系统]
```

## 下次如何直接使用

1. 先从常见需求表或完整树找到完整菜单路径，区分查询需求与提交、缴费、选课等业务操作。
2. 已有 CLI 支持的读取仍优先用现成命令，例如 `education timetable`，不为查询课表再打开网页遍历菜单。其调用方式见 [本科教务](education.md)。
3. 必须使用网页时，复用教务认证，按已记录的站内路由定位；若直达未能正确加载，回到对应父菜单进入。只有遇到登录错误才恢复认证，不因菜单名或路由名陌生而重新登录。
4. 当前任务只授权查询时，只读取需要的页面，不执行申请、保存、刷新计划、同步成绩、缴费、报名等操作。索引中列出功能不代表用户授权执行它。
5. 导航或页面已经变化时先重新读取菜单，不猜一串路由。菜单中的外部授权链接应从当前官网菜单取得完整目标，避免复用被省略参数的地址。

### 路由差异

- 培养计划菜单使用 `/traningPlanMy`；按当前菜单定位，再从页面读取学分统计。
- 本科个人课表菜单可使用 `/GraduateStudentTimeTable`，CLI 课表适配页面为 `/studentTimeTable`；按实际菜单和数据判断用途。
- 普通课程成绩可从“我的成绩”分支查找；部分页面使用 `/myGrades`，菜单还保留 `/oldStysteMyGrades` 等入口。
- 社会实践课的“我的成绩”属于独立分支，见 [实践成绩查询](education-practice.md)。

### 菜单刷新办法

在本地程序中通过当前会话读取 `/api/sessionservice/session/getSessionUser`，只投影菜单所需字段，不输出完整响应。官方前端先从 `data.auths` 保留 `type==1` 的菜单，按 `orderNo` 排序，以 `authId`／`parentAuthId` 建树（一级菜单的 `parentAuthId==-1`），再按当前院系/角色执行可见性筛选；中文名取 `authNameCh`，目标取 `urlPath`。角色筛选函数位于前端 `Base.generateMenu`，菜单转换位于会话存储的 `listToTree` 调用处。

优先复用 `withClient` 与本地会话，完成这一次读取即可获取全部分支，无须为了菜单树启动 Chrome。会话确实失效时按主文档恢复认证。页面列表、原始会话、权限按钮等其他字段不进入文档；如果出现无法归属的父节点或结构变化，先查明原因，不把不完整树标记为完整。
