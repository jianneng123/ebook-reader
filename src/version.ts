import pkg from '../package.json';

/**
 * 应用版本唯一来源：package.json 的 version 字段。
 * 禁止在 UI、文档标题或产物里另写死版本号，避免多处口径漂移。
 */
export const APP_VERSION: string = pkg.version;

/** 界面展示标签：v 前缀 + package.json 版本号。 */
export function versionLabel(): string {
  return `v${APP_VERSION}`;
}
