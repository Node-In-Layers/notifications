import { Config, XOR } from '@node-in-layers/core'
import type { NotificationChannel } from './core/types.js'

export enum NotificationsNamespace {
  Core = '@node-in-layers/notifications',
  Backend = '@node-in-layers/notifications/backend',
}

export type EmailTemplateSource = Readonly<{
  subject?: string
  text?: string
  html?: string
}>

export type NotificationTemplateSource = XOR<string, EmailTemplateSource>

export type NotificationTemplatesConfig = Readonly<
  Record<string, Readonly<Record<string, NotificationTemplateSource>>>
>

export type SmtpEmailConfig = Readonly<{
  host: string
  port: number
  secure?: boolean
  auth?: Readonly<{
    user: string
    pass: string
  }>
  from: string
  defaultTo?: readonly string[]
  subjectPrefix?: string
  transportOptions?: Readonly<Record<string, unknown>>
}>

export type CoreNotificationsConfig = Readonly<{
  defaultTtl?: number
  noTTL?: boolean
}>

export type BackendNotificationsConfig = Readonly<{
  adminUrl?: string
  adminEmails?: readonly string[]
  email?: SmtpEmailConfig
  notifiers?: Readonly<Record<string, string>>
  defaultChannels?: readonly (NotificationChannel | string)[]
  templates?: NotificationTemplatesConfig
  persistNotifications?: boolean
  useDatabaseConfig?: boolean
  databaseConfigKey?: string
  useDatabaseTemplates?: boolean
  userResolution?: Readonly<{
    userModel?: string
    userResolverFeature?: string
    defaultChannels?: readonly (NotificationChannel | string)[]
  }>
  tasks?: Readonly<{
    enabled?: boolean
  }>
}>

export type NotificationsConfig = Readonly<{
  [NotificationsNamespace.Core]?: CoreNotificationsConfig
  [NotificationsNamespace.Backend]?: BackendNotificationsConfig
}>

export type ConfigWithNotifications = Config & NotificationsConfig
