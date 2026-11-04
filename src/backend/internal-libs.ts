import { createErrorObject } from '@node-in-layers/core'
import {
  BackendNotificationsConfig,
  NotificationTemplateSource,
} from '../types.js'
import {
  Notification,
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationStatus,
  NotificationTarget,
  NotificationUser,
} from '../core/types.js'

export type NotificationInvocation = Readonly<{
  channel: string
  target?: NotificationTarget
  notifier?: string
}>

export const getEffectiveNotifiers = (
  args: Readonly<{
    config: BackendNotificationsConfig
    notification: Notification
  }>
) => ({
  ...(args.config.notifiers ?? {}),
  ...(args.notification.notifiers ?? {}),
})

export const resolveChannels = (
  args: Readonly<{
    config: BackendNotificationsConfig
    notification: Notification
  }>
) => {
  const notifiers = getEffectiveNotifiers(args)
  if (args.notification.targets && args.notification.targets.length > 0) {
    return args.notification.targets.map(target => target.channel)
  }
  const configuredChannels =
    args.notification.channels ??
    args.config.defaultChannels ??
    Object.keys(notifiers)
  if (configuredChannels.length > 0) {
    return configuredChannels
  }
  return args.config.email ? [NotificationChannel.Email] : []
}

export const resolveInvocations = (
  args: Readonly<{
    config: BackendNotificationsConfig
    notification: Notification
  }>
): readonly NotificationInvocation[] => {
  const notifiers = getEffectiveNotifiers(args)
  if (args.notification.targets && args.notification.targets.length > 0) {
    return args.notification.targets.map(target => ({
      channel: target.channel,
      target,
      notifier: target.notifier ?? notifiers[target.channel],
    }))
  }
  return resolveChannels(args).map(channel => ({
    channel,
    notifier: notifiers[channel],
  }))
}

export const getStaticTemplate = (
  args: Readonly<{
    config: BackendNotificationsConfig
    channel: string
    type: string
  }>
): Readonly<{ template?: string; htmlTemplate?: string }> => {
  const source: NotificationTemplateSource | undefined =
    args.config.templates?.[args.channel]?.[args.type]
  if (!source) {
    return {}
  }
  if (typeof source === 'string') {
    return {
      template: source,
    }
  }
  return {
    template: source.text,
    htmlTemplate: source.html,
  }
}

export const createDeliveryResults = (
  results: readonly NotificationDeliveryResult[]
) => {
  return results.reduce<Record<string, NotificationDeliveryResult>>(
    (acc, result) => {
      return {
        ...acc,
        [result.channel]: result,
      }
    },
    {}
  )
}

export const resolveDeliveryStatus = (
  results: readonly NotificationDeliveryResult[]
) => {
  const successes = results.filter(result => result.success)
  if (successes.length === results.length) {
    return NotificationStatus.Sent
  }
  if (successes.length > 0) {
    return NotificationStatus.PartialFailure
  }
  return NotificationStatus.Failed
}

export const parseModelReference = (reference: string) => {
  const index = reference.lastIndexOf('.')
  if (index === -1) {
    return createErrorObject(
      'INVALID_USER_MODEL_REFERENCE',
      `Invalid user model reference "${reference}". Expected "domain.PluralModelName".`
    )
  }
  return {
    domain: reference.slice(0, index),
    modelName: reference.slice(index + 1),
  }
}

export const createUserTargets = (
  args: Readonly<{
    channels: readonly (NotificationChannel | string)[]
    user: NotificationUser
  }>
): readonly NotificationTarget[] => {
  return args.channels.reduce<NotificationTarget[]>((acc, channel) => {
    if (channel === NotificationChannel.Email && args.user.email) {
      return acc.concat([
        {
          channel,
          to: [args.user.email],
        },
      ])
    }
    if (channel === NotificationChannel.Sms && args.user.phoneNumber) {
      return acc.concat([
        {
          channel,
          phoneNumbers: [args.user.phoneNumber],
        },
      ])
    }
    return acc
  }, [])
}

export const createUserTemplateData = (user: NotificationUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  phoneNumber: user.phoneNumber,
})
