import Handlebars from 'handlebars'
import { JsonObj } from 'functional-models'
import { Notification, NotificationChannel } from './types.js'

const millisecondsPerSecond = 1000

export const defaultSystemTextTemplate = `{{title}}

{{message}}

System: {{systemName}}
Environment: {{environment}}
Runtime: {{runtimeId}}
Time: {{datetime}}`

export const defaultExecutionFailureTextTemplate = `{{domain}}.{{functionName}} failed

{{error.message}}

{{#if error.code}}Code: {{error.code}}
{{/if}}{{#if error.details}}Details: {{error.details}}
{{/if}}{{#if error.trace}}Trace:
{{error.trace}}{{/if}}`

export const defaultUserTextTemplate = '{{message}}'

export const createTTL = (
  args: Readonly<{ datetime: Date | string }>
): number => {
  const date =
    args.datetime instanceof Date ? args.datetime : new Date(args.datetime)
  return Math.floor(date.getTime() / millisecondsPerSecond)
}

export const renderTemplate = (
  args: Readonly<{ template: string; data: JsonObj; noEscape?: boolean }>
): string => {
  return Handlebars.compile(args.template, {
    noEscape: args.noEscape,
  })(args.data)
}

export const buildTemplateData = (
  args: Readonly<{
    notification: Notification
    channel: NotificationChannel | string
  }>
): JsonObj => {
  return {
    title: args.notification.title,
    message: args.notification.message,
    severity: args.notification.severity,
    type: args.notification.type,
    channel: args.channel,
    ...(args.notification.data ?? {}),
  }
}

export const renderNotificationTemplate = (
  args: Readonly<{
    template: string
    notification: Notification
    channel: NotificationChannel | string
  }>
): string => {
  return renderTemplate({
    template: args.template,
    data: buildTemplateData({
      notification: args.notification,
      channel: args.channel,
    }),
  })
}

export const parseNotifierTarget = (
  args: Readonly<{ notifier: string }>
): Readonly<{ domain: string; feature: string }> => {
  const index = args.notifier.lastIndexOf('.')
  if (index === -1) {
    throw new Error(
      `Invalid notifier "${args.notifier}". Expected "domain.feature".`
    )
  }
  const domain = args.notifier.slice(0, index).trim()
  const feature = args.notifier.slice(index + 1).trim()
  if (!domain || !feature) {
    throw new Error(
      `Invalid notifier "${args.notifier}". Expected "domain.feature".`
    )
  }
  return {
    domain,
    feature,
  }
}
