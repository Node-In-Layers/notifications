import { randomUUID } from 'node:crypto'
import {
  Response,
  CrossLayerProps,
  ErrorObject,
  FeaturesContext,
  annotatedFunction,
  createErrorObject,
  isErrorObject,
} from '@node-in-layers/core'
import { asyncMap } from 'modern-async'
import {
  JsonAble,
  JsonObj,
  PrimaryKeyType,
  queryBuilder,
} from 'functional-models'
import {
  BackendNotificationsConfig,
  ConfigWithNotifications,
  NotificationsNamespace,
} from '../types.js'
import {
  CoreServicesLayer,
  Notification,
  NotificationChannel,
  NotificationChannelFeature,
  NotificationChannelProps,
  NotificationConfigRecord,
  NotificationDeliveryResult,
  NotificationSeverity,
  NotificationStatus,
  NotificationTemplateRecord,
  NotificationType,
  NotificationUser,
  SendExecutionFailureNotificationSchema,
  SendNotificationProps,
  SendNotificationResult,
  SendNotificationSchema,
  SendSystemNotificationSchema,
  SendUserNotificationSchema,
} from '../core/types.js'
import {
  parseNotifierTarget,
  renderNotificationTemplate,
} from '../core/libs.js'
import {
  buildExecutionFailureTemplateData,
  buildSystemTemplateData,
  mergeNotificationConfig,
} from './libs.js'
import {
  NotificationInvocation,
  createDeliveryResults,
  createUserTargets,
  createUserTemplateData,
  getStaticTemplate,
  parseModelReference,
  resolveDeliveryStatus,
  resolveInvocations,
} from './internal-libs.js'
import {
  BackendFeatures,
  BackendFeaturesLayer,
  BackendServicesLayer,
  FailureNotificationMetadata,
  FailureWrappableFunction,
} from './types.js'

const defaultDatabaseConfigKey = 'default'

export const create = (
  context: FeaturesContext<
    ConfigWithNotifications,
    BackendServicesLayer & CoreServicesLayer,
    BackendFeaturesLayer
  >
): BackendFeatures => {
  const _getCoreCruds = () =>
    context.services[NotificationsNamespace.Core]?.cruds

  const _getStaticConfig = () =>
    context.config[NotificationsNamespace.Backend] ?? {}

  const _notificationsEnabled = () => _getStaticConfig().enabled !== false

  const _findDatabaseConfig = async (
    staticConfig: BackendNotificationsConfig
  ): Promise<NotificationConfigRecord | undefined> => {
    const cruds = _getCoreCruds()
    if (!staticConfig.useDatabaseConfig || !cruds?.NotificationConfigs) {
      return undefined
    }
    const result = await cruds.NotificationConfigs.search(
      queryBuilder()
        .property(
          'key',
          staticConfig.databaseConfigKey ?? defaultDatabaseConfigKey
        )
        .compile()
    )
    return result.instances[0]?.toObj<NotificationConfigRecord>()
  }

  const _getEffectiveConfig = async () => {
    const staticConfig = _getStaticConfig()
    const databaseConfig = await _findDatabaseConfig(staticConfig)
    return mergeNotificationConfig({
      staticConfig,
      databaseConfig,
    })
  }

  const _getDatabaseTemplate = async (
    config: BackendNotificationsConfig,
    channel: string,
    type: string
  ): Promise<Readonly<{ template?: string; htmlTemplate?: string }>> => {
    const cruds = _getCoreCruds()
    if (!config.useDatabaseTemplates || !cruds?.NotificationTemplates) {
      return {}
    }
    const result = await cruds.NotificationTemplates.search(
      queryBuilder()
        .property('channel', channel)
        .and()
        .property('type', type)
        .compile()
    )
    const row = await result.instances[0]?.toObj<NotificationTemplateRecord>()
    return row
      ? {
          template: row.body,
          htmlTemplate: row.htmlBody,
        }
      : {}
  }

  const _resolveTemplates = async (
    config: BackendNotificationsConfig,
    channel: string,
    type: string
  ) => {
    const databaseTemplate = await _getDatabaseTemplate(config, channel, type)
    if (databaseTemplate.template || databaseTemplate.htmlTemplate) {
      return databaseTemplate
    }
    return getStaticTemplate({
      config,
      channel,
      type,
    })
  }

  const _persistNotification = async (
    notification: Notification
  ): Promise<Notification> => {
    const cruds = _getCoreCruds()
    if (!_getStaticConfig().persistNotifications || !cruds?.Notifications) {
      return notification
    }
    const created = await cruds.Notifications.create<'id'>(notification)
    return created.toObj<Notification>()
  }

  const _updatePersistedNotification = async (notification: Notification) => {
    const cruds = _getCoreCruds()
    if (!_getStaticConfig().persistNotifications || !cruds?.Notifications) {
      return notification
    }
    const updated = await cruds.Notifications.update(
      notification.id,
      notification
    )
    return updated.toObj<Notification>()
  }

  const _dispatchNotification = async (
    notification: Notification,
    options: JsonObj | undefined,
    crossLayerProps?: CrossLayerProps
  ): Promise<Notification> => {
    const config = await _getEffectiveConfig()
    const invocations = resolveInvocations({
      config,
      notification,
    })
    const results = await asyncMap<
      NotificationInvocation,
      NotificationDeliveryResult
    >(invocations, async invocation => {
      if (!invocation.notifier) {
        if (invocation.channel === NotificationChannel.Email && config.email) {
          const templates = await _resolveTemplates(
            config,
            invocation.channel,
            notification.type
          )
          const emailResult = await _sendEmailChannelNotification(
            {
              channel: invocation.channel,
              notification,
              target: invocation.target,
              template: templates.template,
              htmlTemplate: templates.htmlTemplate,
              options,
            },
            crossLayerProps
          )
          if (isErrorObject(emailResult)) {
            return {
              channel: invocation.channel,
              notifier: 'email',
              success: false,
              sentAt: new Date().toISOString(),
              error: emailResult.error,
            }
          }
          return emailResult
        }
        return {
          channel: invocation.channel,
          notifier: '',
          success: false,
          sentAt: new Date().toISOString(),
          error: {
            code: 'NOTIFIER_NOT_CONFIGURED',
            message: `No notifier is configured for channel ${invocation.channel}.`,
          },
        }
      }

      const target = parseNotifierTarget({ notifier: invocation.notifier })
      const features = context.features.getFeatures(target.domain)
      const notifier = features?.[target.feature] as
        NotificationChannelFeature | undefined
      if (!notifier) {
        return {
          channel: invocation.channel,
          notifier: invocation.notifier,
          success: false,
          sentAt: new Date().toISOString(),
          error: {
            code: 'NOTIFIER_FEATURE_NOT_FOUND',
            message: `Notifier ${invocation.notifier} was not found.`,
          },
        }
      }

      const templates = await _resolveTemplates(
        config,
        invocation.channel,
        notification.type
      )
      const result = await notifier(
        {
          channel: invocation.channel,
          notification,
          target: invocation.target,
          template: templates.template,
          htmlTemplate: templates.htmlTemplate,
          options,
        },
        crossLayerProps
      )

      if (isErrorObject(result)) {
        return {
          channel: invocation.channel,
          notifier: invocation.notifier,
          success: false,
          sentAt: new Date().toISOString(),
          error: result.error,
        }
      }
      return result
    })

    const deliveryResults = createDeliveryResults(results)
    const status = resolveDeliveryStatus(results)

    return _updatePersistedNotification({
      ...notification,
      status,
      deliveryResults,
      sentAt: new Date().toISOString(),
    })
  }

  const _sendEmailChannelNotification = async (
    props: NotificationChannelProps,
    crossLayerProps?: CrossLayerProps
  ) => {
    const config = await _getEffectiveConfig()
    const recipients =
      props.target?.to ??
      props.notification.recipients ??
      config.adminEmails ??
      config.email?.defaultTo ??
      []
    const subjectPrefix = config.email?.subjectPrefix
      ? `${config.email.subjectPrefix} `
      : ''
    const text = props.template
      ? renderNotificationTemplate({
          template: props.template,
          notification: props.notification,
          channel: props.channel,
        })
      : props.notification.message
    const html = props.htmlTemplate
      ? renderNotificationTemplate({
          template: props.htmlTemplate,
          notification: props.notification,
          channel: props.channel,
        })
      : props.notification.htmlMessage
    const result = await context.services[
      NotificationsNamespace.Backend
    ].sendEmail(
      {
        from: config.email?.from,
        to: recipients,
        cc: props.target?.cc,
        bcc: props.target?.bcc,
        replyTo: props.target?.replyTo,
        subject: `${subjectPrefix}${props.notification.title}`,
        text,
        html,
      },
      crossLayerProps
    )

    if (isErrorObject(result)) {
      return result
    }

    return {
      channel: props.channel,
      notifier: 'email',
      success: true,
      sentAt: new Date().toISOString(),
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
      },
    }
  }

  const sendNotification = annotatedFunction(
    SendNotificationSchema,
    async (
      props: SendNotificationProps,
      crossLayerProps?: CrossLayerProps
    ): Promise<Response<SendNotificationResult>> => {
      const notificationProps = {
        id: randomUUID(),
        type: props.type ?? NotificationType.System,
        severity: props.severity ?? NotificationSeverity.Info,
        title: props.title,
        message: props.message,
        htmlMessage: props.htmlMessage,
        data: props.data,
        userId: props.userId,
        recipients: props.recipients,
        targets: props.targets,
        channels: props.channels,
        notifiers: props.notifiers,
        idempotencyKey: props.idempotencyKey,
        status: NotificationStatus.Pending,
        crossLayerProps: crossLayerProps as CrossLayerProps<
          Record<string, JsonAble>
        >,
        ttl: props.ttl,
        createdAt: new Date().toISOString(),
      }

      if (!_notificationsEnabled()) {
        return {
          notification: {
            ...notificationProps,
            status: NotificationStatus.Skipped,
          },
        }
      }

      const notification = await _persistNotification(notificationProps)

      const dispatched = await _dispatchNotification(
        notification,
        props.options,
        crossLayerProps
      )
      return {
        notification: dispatched,
      }
    }
  )

  const sendSystemNotification = annotatedFunction(
    SendSystemNotificationSchema,
    (props, crossLayerProps): Promise<Response<SendNotificationResult>> => {
      const systemData = buildSystemTemplateData({
        config: context.config,
        crossLayerProps,
        data: props.data,
      })
      return sendNotification(
        {
          ...props,
          type: NotificationType.System,
          data: {
            ...systemData,
            runtimeId: context.constants.runtimeId,
          },
        },
        crossLayerProps
      )
    }
  )

  const sendExecutionFailureNotification = annotatedFunction(
    SendExecutionFailureNotificationSchema,
    (props, crossLayerProps): Promise<Response<SendNotificationResult>> => {
      const data = buildExecutionFailureTemplateData({
        config: context.config,
        domain: props.domain,
        functionName: props.functionName,
        error: props.error,
        functionArgs: props.args,
        crossLayerProps,
        data: props.data,
      })
      return sendNotification(
        {
          ...props,
          type: NotificationType.ExecutionFailure,
          title: props.title ?? `${props.domain}.${props.functionName} failed`,
          message: props.message ?? 'A feature or service execution failed.',
          severity: props.severity ?? NotificationSeverity.Error,
          data: {
            ...data,
            runtimeId: context.constants.runtimeId,
          },
          options: props.options,
        },
        crossLayerProps
      )
    }
  )

  const _resolveUserFromModel = async (
    userId: PrimaryKeyType
  ): Promise<NotificationUser | ErrorObject | undefined> => {
    const backendConfig = _getStaticConfig()
    const authConfig = context.config['@node-in-layers/auth/core' as never] as
      { userModel?: string } | undefined
    const reference =
      backendConfig.userResolution?.userModel ??
      authConfig?.userModel ??
      '@node-in-layers/auth/core.Users'
    const parsed = parseModelReference(reference)
    if (isErrorObject(parsed)) {
      return parsed
    }
    const services = context.services.getServices(parsed.domain) as
      | {
          cruds?: Record<
            string,
            {
              retrieve: (id: PrimaryKeyType) => Promise<
                | {
                    toObj: <T>() => Promise<T>
                  }
                | undefined
              >
            }
          >
        }
      | undefined
    const user = await services?.cruds?.[parsed.modelName]?.retrieve(userId)
    return user?.toObj<NotificationUser>()
  }

  const _resolveUser = async (
    userId: PrimaryKeyType | undefined,
    user: NotificationUser | undefined,
    crossLayerProps?: CrossLayerProps
  ): Promise<NotificationUser | ErrorObject | undefined> => {
    if (user) {
      return user
    }
    const crossLayerUser = (crossLayerProps as { user?: NotificationUser })
      ?.user
    if (crossLayerUser && (!userId || crossLayerUser.id === userId)) {
      return crossLayerUser
    }
    if (!userId) {
      return undefined
    }
    return _resolveUserFromModel(userId)
  }

  const sendUserNotification = annotatedFunction(
    SendUserNotificationSchema,
    async (
      props,
      crossLayerProps
    ): Promise<Response<SendNotificationResult>> => {
      const merged = {
        ...props,
        ...(props.notificationProps ?? {}),
      }
      const user = await _resolveUser(
        merged.userId,
        merged.user,
        crossLayerProps
      )
      if (isErrorObject(user)) {
        return user
      }
      if (!user) {
        return createErrorObject(
          'USER_NOT_FOUND',
          'A user is required to send a user notification.'
        )
      }
      if (user.enabled === false) {
        return createErrorObject(
          'USER_DISABLED',
          'Disabled users cannot be notified.'
        )
      }
      const channels = merged.channels ??
        _getStaticConfig().userResolution?.defaultChannels ??
        _getStaticConfig().defaultChannels ?? [NotificationChannel.Email]
      const userTargets = createUserTargets({
        channels,
        user,
      })
      return sendNotification(
        {
          ...merged,
          type: NotificationType.User,
          userId: user.id,
          data: {
            ...(merged.data ?? {}),
            user: createUserTemplateData(user),
          },
          targets: [...userTargets, ...(merged.targets ?? [])],
        },
        crossLayerProps
      )
    }
  )

  const wrapWithFailureNotification = <
    TFunction extends FailureWrappableFunction,
  >(
    metadata: FailureNotificationMetadata,
    method: TFunction
  ): TFunction => {
    const wrapped = ((
      methodProps: Parameters<TFunction>[0],
      crossLayerProps?: CrossLayerProps
    ) =>
      Promise.resolve()
        .then(() => method(methodProps, crossLayerProps))
        .then(async result => {
          if (isErrorObject(result)) {
            await sendExecutionFailureNotification(
              {
                domain: metadata.domain,
                functionName: metadata.functionName,
                error: result,
                args: methodProps as JsonObj,
              },
              crossLayerProps
            ).catch(() => undefined)
          }
          return result
        })
        .catch(async error => {
          await sendExecutionFailureNotification(
            {
              domain: metadata.domain,
              functionName: metadata.functionName,
              error: error as JsonAble,
              args: methodProps as JsonObj,
            },
            crossLayerProps
          ).catch(() => undefined)
          throw error
        })) as unknown as TFunction

    // Preserve annotatedFunction metadata on the wrapper function object.
    // eslint-disable-next-line functional/immutable-data
    return Object.assign(wrapped, {
      functionName: (method as any).functionName,
      domain: (method as any).domain,
      schema: (method as any).schema,
    }) as TFunction
  }

  return {
    sendNotification,
    sendUserNotification,
    sendSystemNotification,
    sendExecutionFailureNotification,
    wrapWithFailureNotification,
  }
}
