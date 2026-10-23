# 体育场馆预约：导航、查询与操作边界

用于查找同济体育场馆、开放时间、可预约时段、预约规则和本人订单入口。场馆名称和资源编号见 [公开场馆目录](stadium-catalog.md)。这是体育预约系统，与 `space.tongji.edu.cn` 的图书馆座位系统分开。

## 入口与认证

官方入口：`https://stadium.tongji.edu.cn/pc/#/`，页面标题“上海同济大学体育场馆预约平台”。公开首页和个人预约列表可用于查场馆；实时预约条件、个人订单等从官网登录后读取。

点击“登 录”走学校统一认证，复用已有认证状态；页面要求本人操作时再请用户扫码或输入密码。当前 CLI 的登录服务为 Canvas、图书馆和教务，体育场馆使用浏览器会话。

## 功能在什么位置

下表路由均位于 `/pc/#` 后，区分大小写；`apointmentDetails` 是官网实际拼写，不能改成 `appointmentDetails`。不靠猜测参数直接访问业务详情。

| 位置／功能 | 路由 | 用法 |
| --- | --- | --- |
| 首页 | `/` | 系统公告、运动分类、场馆名称／活动类型搜索、场馆推荐、“更多 >” |
| 个人预约列表 | `/Venue/1` | 校区、类型单选筛选，名称搜索，场馆卡片及分页；首页分类也指向此处 |
| 群体预约列表 | `/Venue/0` | 仅通过群体资格检查后增加菜单；不是所有学生都有此权限 |
| 个人场馆详情／时段表 | `/apointmentDetails/1/<venueId>/<isType>` | 场馆公告、地址、电话、时间，运动标签、日期、场地时段表、规则、金额、“立即下单”；从当前列表卡片进入 |
| 专场预约申请 | `/apointmentDetails/0/<venueId>/<isType>` | 身份类型、申请单位、用途、单次／周期场地、附件等；与个人按小时选场不同 |
| 我的订单 | `/Order` | 个人订单、专场订单、随行订单；专场订单标签按实际条件显示 |
| 爽约记录 | `/breakAppointList` | 入口会先查询本人禁用／爽约信息；不为目录探索读取个人记录 |
| 爽约规则 | `/breakRule` | 独立规则页，内容可从规则配置读取 |
| 钱包 | `/wallet` | 不要根据菜单存在推断已开通支付，也不要仅凭旧帮助文字推断未开通 |
| 随行人管理 | `/entourageManagement/` | 管理随行人员；增加、修改、删除人员均不属于目录探索 |
| 帮助中心 | `/helpCenter` | 内容来自 `/venue/moreSetting/getOne` 的 `help` |
| 投诉建议 | 普通用户 `/venueList`，管理身份 `/personList` | 按当前身份进入相应投诉建议页面 |
| 个人资料 | `/myInformation` | 点击页头姓名；手机号不符合要求时也可能弹出资料修改提示，按用户提供的信息处理 |
| 退出 | 无固定页面 | 会调用 `/newLogout?param=pc`，属于登出操作，探索时不点击 |

登录后页头的基础菜单在前端定义为：个人预约、我的订单、爽约记录、钱包、随行人管理、帮助中心、投诉建议、退出；有资格时插入“群体预约”。首页未登录时只显示登录按钮。按当前账号角色使用可见入口。

## 下次查询的最短流程

1. **只问有什么场馆／在哪里／大致开放时间**：先查目录子文件；要当前结果时直接打开公开个人预约列表，不先登录。按校区、运动筛选；注意运动分类存在不等于当前有对应场馆，卡片时间也不代表当天一定有空位。
2. **问某日某时能否预约／当前价格**：复用一个可控浏览器上下文，通过官网“登 录”恢复本站会话。只在学校认证页面要求本人操作时请用户扫码，密码登录由本人在官方页面选择，不代填。统一认证与本站会话是两层状态，不能互相替代。
3. 从实时列表定位场馆，点击卡片进入个人详情。先读场馆公告、运动类型和预约规则，再选官网提供的日期标签。页面变化时观察当前加载链路，按下文参数核对时段数据。
4. 读取目标日期的场地时段表，报告校区、场馆、运动、日期、起止时间、可选场地、价格和限制。只查询时无需点击任何时段、立即下单或条款按钮。结果为空、请求失败、未放号、暂不开放是不同情况。
5. 日期和资源编号均从当前响应获取。不要固定假设可提前 7 天、固定小时价格或根据数组下标猜日期。页面可选日期、场馆公告及当前规则优先于旧目录快照。
6. 同一次任务复用上下文，结束后正常关闭；`withBrowser` 期间持有状态锁，不能同时再跑同一个 `TONGJI_CAMPUS_HOME` 的校园脚本。不把长期不返回的认证请求当作“还在等扫码”无限等待。

现有辅助会从本地恢复已允许的学校认证数据，但 `SCHOOL_HOSTS` 尚未加入 stadium，本站独立 Cookie／浏览器状态没有被当前 CLI 持久保存；连续任务复用浏览器上下文，新建上下文时从官网恢复认证。各服务使用各自认证头。不读取、输出或写入文档中的凭据包括：`currentUser` 完整响应、`params.JSESSIONID`、sessionStorage、Cookie、认证回调参数和个人二维码。

## 预约规则

规则配置更新：2026-10。办理时读取目标场馆公告和当日页面。

- **放号时间**：帮助文字写沪西 11:30、嘉定 12:00、四平 13:00；校区配置同时列彰武、南校区 13:00。这是放号时间，不是场馆开门时间。
- **日期范围**：帮助称可预约后 7 天，例子包含当天至第 7 天；实际显示日期必须以当前时段表为准，不能机械生成 7 个或 8 个日期。
- **取消**：帮助及预订须知均要求距离使用时间超过 2 小时；正好 2 小时不在允许范围。是否可取消仍看具体订单和当时官网结果。
- **天气等原因**：帮助说明室外场地受雨天等影响时可提供原因及图片申诉，由管理员审核；不是自动退款或自动消除爽约，不能代编凭证。
- **爽约**：公开 `breakText` 写半年内第 1 次提醒，第 2 次禁用 1 个月，第 3 次禁用 3 个月；不将此信息当成本人爽约状态。
- **紧张程度**：不同场地可能有不同的每次、每日、每周额度，详情依据该运动当前规则。不要把一个网球场的额度套到全部运动。
- **随行人**：帮助称需添加随行人，入场出示随行二维码及本人一卡通，可在使用前 2 小时补充／修改；按当前订单表单确认人数和资格，使用用户提供的随行人信息。
- **支付**：帮助仍写“在线支付及钱包功能暂未上线”，但当前前端含支付、待支付订单及财务支付跳转流程。支付是否启用及金额从当前订单流程确认，待支付与预约成功分别汇报。

## 只读请求线索

需要结构化查询结果时参考下列协议。API（应用程序接口，即网页读取后台数据的地址）均相对于 `https://stadium.tongji.edu.cn` 根目录，**没有 `/pc` 前缀**。公开接口可使用无登录信息的请求；需要登录的接口留在正常官网上下文内。

| 用途 | 方法与路径 | 参数／响应 |
| --- | --- | --- |
| 首页运动分类 | POST `/manage/motionType/typeList` | 响应直接是数组，含 `venueType,id`，没有 `data` 外壳 |
| 校区及放号时间 | POST `/manage/campus/list` | `rows` 含 `id,campusName,openTime`，`total:5` |
| 校区下的运动类型 | POST `/manage/motionType/typeListByCampus` | 表单 `campusId`，全部为空字符串；响应直接是数组 |
| 场馆列表 | POST `/manage/venue/listNoVenue` | 表单 `typeIds,campusIds,venueName,pageNum,pageSize,flag`；个人 `flag:0`，群体 `flag:1`。响应 `rows,total,code`，个人目录见目录子文件；数组参数按官网表单序列化 |
| 系统公告 | POST `/venue/notice/newSysNotice?typeId=1` | 首页和列表实际加载；`data.title/content/abstract`，保留原公告日期，不把旧公告解释为今天发生 |
| 帮助与预订须知 | POST `/venue/moreSetting/getOne` | 响应根对象的 `help,clause,title,breakText`，不是 `data.help` |
| 场馆详情 | POST `/manage/venue/queryVenueById` | 表单 `id`，读取 `data.motionTypes` 中 `id,name,tension` |
| 场馆公告 | POST `/venue/notice/newStadiumNotice?id=<venueId>` | `data.title/content`，与系统公告区分 |
| 可选日期 | POST `/manage/fieldDetail/queryFieldReserveSituationIsFull` | 表单 `id,feildType,date`；**`feildType` 为官网拼写**。`data` 日期项含 `date,dateId`，后续使用当前返回值 |
| 当日场地时段表 | POST `/manage/fieldDetail/queryFieldSituation` | JSON `fieldType,date,venueId,dateId`；`data` 为场地数组，各含 `fieldName,fieldId,fieldDetailStatus,priceList` |
| 运动预约限制 | POST `/tbReservation/tbReservation/getReservation?id=<tension>` | 从运动元数据取得 `tension`，不猜编号；详情使用 `typeName,useNum,weekNum` 等规则 |
| 本人当日／周额度 | POST `/venue/personal/checkRule` | 表单 `venueId,venTypeId,scheduleDate,tension`，结果 `isWeek,isDay,dayNum` |
| 我的订单列表 | GET `/venue/personal/personalOrderlist` | `pageNo,pageSize`，返回 `records,total`；只在用户要求本人订单时读 |
| 专场／随行订单 | GET `/venue/team/teamOrderlist`、`/venue/personal/selectEntourageOrder` | 同样按 `pageNo,pageSize` 分页；不读取无关人员信息 |

首页推荐 `pageSize:8`，个人列表默认 12；完整查询按 `total` 读取后续页。

列表筛选的 `campusIds` 元素取校区 `id`，**`typeIds` 元素实际取运动名称 `venueType`**，不是首页运动 UUID，也不是详情运动 `motionTypes.id`。例如嘉定网球的筛选按官网编码为 `campusIds[0]=3&typeIds[0]=网球`；详情和时段查询再从场馆元数据取得各自编号，三种标识不可混用。

多数响应业务成功码为数值或字符串 0；部分接口返回原始数组或根配置对象。HTTP 200 可能是登录 HTML 或业务失败，必须先核实内容类型、结构和业务码。业务 401 由官网清理本站状态并返回首页；业务 500、网络超时或 504 不应反复触发重新扫码。认证回调出现 504 时检查站点响应；公开目录可继续读取。

时段状态：`0` 可选、`1` 本地已选，`-1/-2/-3` 均不可选，`flag` 为假不渲染；负值表示不可选，具体原因结合页面提示判断。前端切换日期会清空选择并重新查询；当前空位是快照，提交前可能变化。

## 下单与其他写入操作

用户明确提出预约时，先确定校区／场馆、运动、日期、起止时间、可接受替代场地、费用范围及官网要求的随行人信息。已授权且条件齐全时沿官网正常流程继续。

个人链路在当前前端为：选时段（本地选择）→“立即下单”（检查欠费、读取条款）→条款弹窗“提交订单”→ **POST `/venue/personal/ConfirmOrder` 创建订单** →订单详情／支付。创建请求使用官网加密参数，并可能要求人工验证码，不能手工仿造、绕过或自动破解。目录探索停在读取阶段，不点击这些按钮试验。

群体链路的提交会调用 `/process/venue/add` 或 `/process/venue/importVenue`，随后读取锁定订单 `getVenueList`；弹窗还没最终完成也可能已经创建／锁定资源，不能拿它试探场馆是否有空。个人和群体链路不可混用。

“申诉”也不是安全的只读入口：首页和订单组件的 `goOpinionWarranty` 会先调用 **`/record/insertAppealByUser`**，再跳转表单。支付、取消、退订、修改资料、增加随行人、投诉、问卷“已完成”均有独立写入，不随探索触发。`GET /newLogout` 同样会改变状态，不能按 GET／POST 判断读写。

下单后，以本人订单的场馆、时段、金额、状态和必要凭证核对结果；超时或返回不明先查订单，不能重复创建。不要为了清理探索而取消用户已有订单。

## 页面改变时如何定位

从当前 `/pc/` HTML 读取脚本，再由 manifest 定位路由组件；文件带版本哈希，使用当前资源版本。可搜索 `Venue`、`apointmentDetails`、`personalAjax`、`queryVenueByIdApi`、`querySiteAll`、`getFied`、`agreeTerms`、`goOpinionWarranty`；只提取相关函数，避免输出整包组件库、密钥材料或个人响应。新功能按当前源码和实际响应继续核对并记录。
