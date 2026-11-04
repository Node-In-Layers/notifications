import merge from 'lodash/merge.js'
import {
  CrossLayerProps,
  ErrorObject,
  createErrorObject,
  isErrorObject,
} from '@node-in-layers/core'
import { JsonAble, JsonObj } from 'functional-models'
import {
  BackendNotificationsConfig,
  ConfigWithNotifications,
  NotificationsNamespace,
} from '../types.js'
import { NotificationConfigRecord } from '../core/types.js'

const omitUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, unknown] => {
      return entry[1] !== undefined
    })
  ) as Partial<T>

export const normalizeFailureError = (
  error: JsonAble | ErrorObject | unknown
): ErrorObject['error'] => {
  if (isErrorObject(error)) {
    return error.error
  }
  if (error instanceof Error) {
    return {
      code: error.name || 'ERROR',
      message: error.message,
      trace: error.stack,
    }
  }
  return createErrorObject('EXECUTION_FAILURE', 'Execution failed.', error)
    .error
}

export const mergeNotificationConfig = (
  args: Readonly<{
    staticConfig: BackendNotificationsConfig | undefined
    databaseConfig?: NotificationConfigRecord
  }>
): BackendNotificationsConfig => {
  const databaseConfig = args.databaseConfig
    ? omitUndefined({
        adminEmails: args.databaseConfig.adminEmails,
        email: omitUndefined({
          from: args.databaseConfig.fromEmail,
          subjectPrefix: args.databaseConfig.subjectPrefix,
        }),
        defaultChannels: args.databaseConfig.defaultChannels,
        notifiers: args.databaseConfig.notifiers,
      })
    : {}

  return merge({}, args.staticConfig ?? {}, databaseConfig)
}

export const buildSystemTemplateData = (
  args: Readonly<{
    config: ConfigWithNotifications
    crossLayerProps?: CrossLayerProps
    data?: JsonObj
  }>
): JsonObj => {
  return {
    systemName: args.config.systemName,
    environment: args.config.environment,
    runtimeId: '',
    datetime: new Date().toISOString(),
    ids: args.crossLayerProps?.logging?.ids ?? [],
    adminUrl: args.config[NotificationsNamespace.Backend]?.adminUrl,
    ...(args.data ?? {}),
  }
}

export const buildExecutionFailureTemplateData = (
  args: Readonly<{
    config: ConfigWithNotifications
    domain: string
    functionName: string
    error: JsonAble | ErrorObject
    functionArgs?: JsonObj
    crossLayerProps?: CrossLayerProps
    data?: JsonObj
  }>
): JsonObj => {
  return {
    ...buildSystemTemplateData({
      config: args.config,
      crossLayerProps: args.crossLayerProps,
      data: args.data,
    }),
    domain: args.domain,
    functionName: args.functionName,
    args: args.functionArgs,
    error: normalizeFailureError(args.error),
  }
}
