export const messages = {
  INVALID_ARGUMENT: ['命令或参数不正确。', '运行 help 查看支持的命令；不要传入密码、Cookie 或令牌。'],
  DEPENDENCY_MISSING: ['本地浏览器依赖尚未安装。', '在 skill 目录运行 npm ci --ignore-scripts。'],
  BROWSER_UNAVAILABLE: ['未找到可用的 Chrome 或 Edge。', '安装 Chrome/Edge，或通过 --browser 选择已安装的浏览器。'],
  BROWSER_FAILED: ['无法启动或连接专属浏览器。', '检查宿主的浏览器启动权限，或通过 --browser 选择另一款已安装的浏览器。'],
  SESSION_BUSY: ['另一个校园助手操作仍在使用会话。', '等待前一操作结束，不要同时启动多个登录或查询。'],
  SESSION_STALE: ['发现异常退出留下的会话操作锁。', '确认本工具进程已经结束后，删除会话目录中的 operation.lock，再重试。不要删除 session.json。'],
  STATE_UNSAFE: ['会话目录的类型或权限不符合要求。', '使用独立、非符号链接且仅当前用户可访问的本地目录。'],
  STATE_IO: ['无法读写本地会话。', '检查本地目录权限；受限环境可设置 TONGJI_CAMPUS_HOME 到允许写入的专属目录。'],
  LOGIN_REQUIRED: ['当前服务需要建立或恢复登录会话。', '运行 auth login --service canvas、library 或 education；会先验证已保存的会话，必要时打开学校认证页面。'],
  LOGIN_TIMEOUT: ['尚未在等待时间内完成登录。', '重新运行 auth login；二维码过期时在学校页面刷新。'],
  LOGIN_CANCELLED: ['登录窗口已关闭，尚未验证成功。', '需要查询时重新运行 auth login。'],
  NETWORK_ERROR: ['无法连接学校服务。', '检查网络及学校访问要求；不要反复重试。'],
  PERMISSION_DENIED: ['学校拒绝了读取请求。', '在学校网页确认当前账号身份及功能权限。'],
  RATE_LIMITED: ['学校服务要求降低访问频率。', '停止查询，稍后再试。'],
  SERVICE_UNAVAILABLE: ['学校服务暂时不可用。', '稍后再试；不要连续重试。'],
  PAGE_CHANGED: ['返回内容与已支持的校园服务格式不同。', '在学校网页检查当前认证、请求参数和响应结构。'],
  UNSAFE_RESPONSE: ['返回的链接不属于允许的只读查询范围。', '在学校官网核对目标地址及跳转用途。'],
  RESULT_TOO_LARGE: ['结果超过读取上限。', '缩小查询范围或按目标课程、日期分别查询。'],
  UNEXPECTED: ['操作未完成。', '检查运行环境、依赖和目标服务状态。']
};

export class CampusError extends Error {
  constructor(code) {
    super(messages[code]?.[0] ?? messages.UNEXPECTED[0]);
    this.name = 'CampusError';
    this.code = Object.hasOwn(messages, code) ? code : 'UNEXPECTED';
  }
}

export function failure(error) {
  const code = error instanceof CampusError ? error.code : 'UNEXPECTED';
  return { ok: false, error: { code, message: messages[code][0], hint: messages[code][1] } };
}

export function networkError(error) {
  // Inspect locally, never return a Playwright error (may contain request URLs/headers).
  return new CampusError(error?.name === 'TargetClosedError' ? 'LOGIN_CANCELLED' : 'NETWORK_ERROR');
}
