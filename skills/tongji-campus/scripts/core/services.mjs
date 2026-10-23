export const SERVICES = ['canvas', 'library', 'education'];
export const SCHOOL_HOSTS = new Set([
  'canvas.tongji.edu.cn', 'iam.tongji.edu.cn', 'webpac.tongji.edu.cn',
  'webpac1.tongji.edu.cn', '1.tongji.edu.cn'
]);
export const LOGIN_URLS = {
  canvas: 'https://canvas.tongji.edu.cn/login',
  library: 'https://webpac1.tongji.edu.cn/OAuth2/tongji/init?isLogout=0&refer=https://webpac.tongji.edu.cn/find/sso/login/tongji/0',
  education: 'https://1.tongji.edu.cn/api/ssoservice/system/loginIn'
};

export function privateCredentials(serviceData = {}) {
  const result = {};
  const edu = serviceData.education;
  if (typeof edu?.sessionId === 'string' && edu.sessionId.length <= 16000 && !/[\r\n]/.test(edu.sessionId)) {
    result.education = { sessionId: edu.sessionId };
  }
  const lib = serviceData.library;
  const forbidden = new Set(['host','cookie','connection','content-type','content-length','origin','referer','mappingpath','groupcode','accept']);
  if (typeof lib?.jwt === 'string' && lib.jwt.length <= 16000 && !/[\r\n]/.test(lib.jwt)
    && /^[a-z0-9-]{1,80}$/i.test(lib.jwtHeader ?? '') && !forbidden.has(lib.jwtHeader.toLowerCase())) {
    result.library = { jwt: lib.jwt, jwtHeader: lib.jwtHeader };
  }
  return result;
}
