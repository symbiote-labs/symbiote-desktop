export const DEFAULT_APP_NAME = 'Cherry Studio'
export const APP_NAME = process.env.CUSTOM_APP_NAME || DEFAULT_APP_NAME
// 是否是定制化产品模式
export const APP_IS_CUSTOM_PRODUCT = APP_NAME !== DEFAULT_APP_NAME
