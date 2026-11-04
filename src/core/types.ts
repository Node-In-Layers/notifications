import {
  CrossLayerProps,
  ErrorObject,
  ModelCrudsFunctions,
  NilAnnotatedFunction,
  Response,
  annotationFunctionProps,
  jsonAbleSchema,
  jsonObjSchema,
} from '@node-in-layers/core'
import { JsonAble, JsonObj, PrimaryKeyType } from 'functional-models'
import { z } from 'zod'
import { NotificationsNamespace } from '../types.js'

export enum NotificationStatus {
  Pending = 'pending',
  Sending = 'sending',
  Sent = 'sent',
  PartialFailure = 'partial_failure',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum NotificationSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

export enum NotificationType {
  System = 'system',
  ExecutionFailure = 'executionFailure',
  User = 'user',
}

export enum NotificationChannel {
  Email = 'email',
  Sms = 'sms',
  Sns = 'sns',
  Webhook = 'webhook',
  Slack = 'slack',
  InApp = 'in_app',
  Custom = 'custom',
}

export type NotificationTarget = Readonly<{
  channel: NotificationChannel | string
  notifier?: string
  to?: readonly string[]
  cc?: readonly string[]
  bcc?: readonly string[]
  replyTo?: string
  phoneNumbers?: readonly string[]
  topicArn?: string
  targetArn?: string
  url?: string
  channelId?: string
  options?: JsonObj
}>

export type NotificationUser = Readonly<{
  id: PrimaryKeyType
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  enabled?: boolean
}> &
  Record<string, JsonAble>

export type NotifiersMap = Readonly<Record<string, string>>

export type NotificationDeliveryResult = Readonly<{
  channel: NotificationChannel | string
  notifier: string
  success: boolean
  sentAt?: string
  details?: JsonObj
  error?: ErrorObject['error']
}>

export type Notification<TData extends JsonObj = JsonObj> = Readonly<{
  id: PrimaryKeyType
  type: NotificationType | string
  severity: NotificationSeverity
  title: string
  message: string
  htmlMessage?: string
  data?: TData
  userId?: PrimaryKeyType
  recipients?: readonly string[]
  targets?: readonly NotificationTarget[]
  channels?: readonly (NotificationChannel | string)[]
  notifiers?: NotifiersMap
  idempotencyKey?: string
  status: NotificationStatus
  deliveryResults?: Readonly<Record<string, NotificationDeliveryResult>>
  taskId?: PrimaryKeyType
  crossLayerProps?: CrossLayerProps<Record<string, JsonAble>>
  ttl?: number
  sentAt?: string
  createdAt?: string
  updatedAt?: string
}>

export type NotificationConfigRecord = Readonly<{
  id: PrimaryKeyType
  key: string
  adminEmails?: readonly string[]
  fromEmail?: string
  subjectPrefix?: string
  defaultChannels?: readonly (NotificationChannel | string)[]
  notifiers?: NotifiersMap
  createdAt?: string
  updatedAt?: string
}>

export type NotificationTemplateRecord = Readonly<{
  id: PrimaryKeyType
  channel: string
  type: string
  body: string
  htmlBody?: string
  createdAt?: string
  updatedAt?: string
}>

export type NotificationChannelProps<
  TData extends JsonObj = JsonObj,
  TOptions extends JsonObj = JsonObj,
> = Readonly<{
  channel: NotificationChannel | string
  notification: Notification<TData>
  target?: NotificationTarget
  template?: string
  htmlTemplate?: string
  options?: TOptions
}>

export type NotificationChannelResult = NotificationDeliveryResult

export type NotificationChannelFeature<
  TData extends JsonObj = JsonObj,
  TOptions extends JsonObj = JsonObj,
> = NilAnnotatedFunction<
  NotificationChannelProps<TData, TOptions>,
  NotificationChannelResult
>

export type NotificationSendOptions = Readonly<{
  severity?: NotificationSeverity
  htmlMessage?: string
  data?: JsonObj
  recipients?: readonly string[]
  targets?: readonly NotificationTarget[]
  channels?: readonly (NotificationChannel | string)[]
  notifiers?: NotifiersMap
  idempotencyKey?: string
  ttl?: number
  options?: JsonObj
}>

export type SendNotificationProps = Readonly<{
  type?: NotificationType | string
  title: string
  message: string
  userId?: PrimaryKeyType
}> &
  NotificationSendOptions

export type SendNotificationResult = Readonly<{
  notification: Notification
}>

export type SendUserNotificationProps = Readonly<{
  userId?: PrimaryKeyType
  user?: NotificationUser
  title: string
  message: string
  notificationProps?: NotificationSendOptions
}> &
  NotificationSendOptions

export type SendSystemNotificationProps = Readonly<{
  title: string
  message: string
}> &
  NotificationSendOptions

export type SendExecutionFailureNotificationProps = Readonly<{
  domain: string
  functionName: string
  error: JsonAble | ErrorObject
  args?: JsonObj
  title?: string
  message?: string
}> &
  NotificationSendOptions

export const primaryKeySchema: z.ZodType<PrimaryKeyType> = z.union([
  z.string(),
  z.number().int(),
])

export const NotificationTargetSchema: z.ZodType<NotificationTarget> = z
  .object({
    channel: z.union([z.enum(NotificationChannel), z.string()]),
    notifier: z.string().optional(),
    to: z.array(z.string()).readonly().optional(),
    cc: z.array(z.string()).readonly().optional(),
    bcc: z.array(z.string()).readonly().optional(),
    replyTo: z.string().optional(),
    phoneNumbers: z.array(z.string()).readonly().optional(),
    topicArn: z.string().optional(),
    targetArn: z.string().optional(),
    url: z.string().optional(),
    channelId: z.string().optional(),
    options: jsonObjSchema.optional(),
  })
  .readonly()

export const NotificationUserSchema: z.ZodType<NotificationUser> = z
  .object({
    id: primaryKeySchema,
    email: z.string().optional(),
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phoneNumber: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .catchall(jsonAbleSchema)
  .readonly()

export const NotificationDeliveryResultSchema: z.ZodType<NotificationDeliveryResult> =
  z
    .object({
      channel: z.union([z.enum(NotificationChannel), z.string()]),
      notifier: z.string(),
      success: z.boolean(),
      sentAt: z.string().optional(),
      details: jsonObjSchema.optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          details: z.string().optional(),
          data: z.record(z.string(), jsonAbleSchema).optional(),
          trace: z.string().optional(),
          cause: z.any().optional(),
        })
        .readonly()
        .optional(),
    })
    .readonly()

export const NotificationSchema: z.ZodType<Notification> = z
  .object({
    id: primaryKeySchema,
    type: z.union([z.enum(NotificationType), z.string()]),
    severity: z.enum(NotificationSeverity),
    title: z.string(),
    message: z.string(),
    htmlMessage: z.string().optional(),
    data: jsonObjSchema.optional(),
    userId: primaryKeySchema.optional(),
    recipients: z.array(z.string()).readonly().optional(),
    targets: z.array(NotificationTargetSchema).readonly().optional(),
    channels: z
      .array(z.union([z.enum(NotificationChannel), z.string()]))
      .readonly()
      .optional(),
    notifiers: z.record(z.string(), z.string()).readonly().optional(),
    idempotencyKey: z.string().optional(),
    status: z.enum(NotificationStatus),
    deliveryResults: z
      .record(z.string(), NotificationDeliveryResultSchema)
      .readonly()
      .optional(),
    taskId: primaryKeySchema.optional(),
    crossLayerProps: z
      .custom<CrossLayerProps<Record<string, JsonAble>>>()
      .optional(),
    ttl: z.number().int().optional(),
    sentAt: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .readonly()

export const NotificationSendOptionsSchema = z
  .object({
    severity: z.enum(NotificationSeverity).optional(),
    htmlMessage: z.string().optional(),
    data: jsonObjSchema.optional(),
    recipients: z.array(z.string()).readonly().optional(),
    targets: z.array(NotificationTargetSchema).readonly().optional(),
    channels: z
      .array(z.union([z.enum(NotificationChannel), z.string()]))
      .readonly()
      .optional(),
    notifiers: z.record(z.string(), z.string()).readonly().optional(),
    idempotencyKey: z.string().optional(),
    ttl: z.number().int().optional(),
    options: jsonObjSchema.optional(),
  })
  .readonly()

export const SendNotificationPropsSchema: z.ZodType<SendNotificationProps> = z
  .intersection(
    z.object({
      type: z.union([z.enum(NotificationType), z.string()]).optional(),
      title: z.string(),
      message: z.string(),
      userId: primaryKeySchema.optional(),
    }),
    NotificationSendOptionsSchema
  )
  .readonly()

export const SendNotificationResultSchema: z.ZodType<SendNotificationResult> = z
  .object({
    notification: NotificationSchema,
  })
  .readonly()

export const SendUserNotificationPropsSchema: z.ZodType<SendUserNotificationProps> =
  z
    .intersection(
      z.object({
        userId: primaryKeySchema.optional(),
        user: NotificationUserSchema.optional(),
        title: z.string(),
        message: z.string(),
        notificationProps: NotificationSendOptionsSchema.optional(),
      }),
      NotificationSendOptionsSchema
    )
    .readonly()

export const SendSystemNotificationPropsSchema: z.ZodType<SendSystemNotificationProps> =
  z
    .intersection(
      z.object({
        title: z.string(),
        message: z.string(),
      }),
      NotificationSendOptionsSchema
    )
    .readonly()

export const SendExecutionFailureNotificationPropsSchema: z.ZodType<SendExecutionFailureNotificationProps> =
  z
    .intersection(
      z.object({
        domain: z.string(),
        functionName: z.string(),
        error: z.union([jsonAbleSchema, z.custom<ErrorObject>()]),
        args: jsonObjSchema.optional(),
        title: z.string().optional(),
        message: z.string().optional(),
      }),
      NotificationSendOptionsSchema
    )
    .readonly()

export const NotificationChannelPropsSchema: z.ZodType<NotificationChannelProps> =
  z
    .object({
      channel: z.union([z.enum(NotificationChannel), z.string()]),
      notification: NotificationSchema,
      target: NotificationTargetSchema.optional(),
      template: z.string().optional(),
      htmlTemplate: z.string().optional(),
      options: jsonObjSchema.optional(),
    })
    .readonly()

export const createNotificationChannelSchema = <
  TData extends JsonObj = JsonObj,
  TOptions extends JsonObj = JsonObj,
>(
  args: Readonly<{
    functionName: string
    domain: string
    description?: string
  }>
) =>
  annotationFunctionProps<
    NotificationChannelProps<TData, TOptions>,
    NotificationChannelResult
  >({
    functionName: args.functionName,
    domain: args.domain,
    description: args.description,
    args: NotificationChannelPropsSchema as z.ZodType<
      NotificationChannelProps<TData, TOptions>
    >,
    returns: NotificationDeliveryResultSchema,
  })

export const SendNotificationSchema = annotationFunctionProps<
  SendNotificationProps,
  SendNotificationResult
>({
  functionName: 'sendNotification',
  domain: NotificationsNamespace.Backend,
  description: 'Sends a notification through configured channels.',
  args: SendNotificationPropsSchema,
  returns: SendNotificationResultSchema,
})

export const SendUserNotificationSchema = annotationFunctionProps<
  SendUserNotificationProps,
  SendNotificationResult
>({
  functionName: 'sendUserNotification',
  domain: NotificationsNamespace.Backend,
  description: 'Sends a notification to a user.',
  args: SendUserNotificationPropsSchema,
  returns: SendNotificationResultSchema,
})

export const SendSystemNotificationSchema = annotationFunctionProps<
  SendSystemNotificationProps,
  SendNotificationResult
>({
  functionName: 'sendSystemNotification',
  domain: NotificationsNamespace.Backend,
  description: 'Sends a system notification.',
  args: SendSystemNotificationPropsSchema,
  returns: SendNotificationResultSchema,
})

export const SendExecutionFailureNotificationSchema = annotationFunctionProps<
  SendExecutionFailureNotificationProps,
  SendNotificationResult
>({
  functionName: 'sendExecutionFailureNotification',
  domain: NotificationsNamespace.Backend,
  description: 'Sends a notification for a failed feature or service call.',
  args: SendExecutionFailureNotificationPropsSchema,
  returns: SendNotificationResultSchema,
})

export type NotificationsPublicFeatures = Readonly<{
  sendNotification: NilAnnotatedFunction<
    SendNotificationProps,
    SendNotificationResult
  >
  sendUserNotification: NilAnnotatedFunction<
    SendUserNotificationProps,
    SendNotificationResult
  >
  sendSystemNotification: NilAnnotatedFunction<
    SendSystemNotificationProps,
    SendNotificationResult
  >
  sendExecutionFailureNotification: NilAnnotatedFunction<
    SendExecutionFailureNotificationProps,
    SendNotificationResult
  >
}>

export type CoreCruds = Readonly<{
  Notifications: ModelCrudsFunctions<Notification>
  NotificationConfigs: ModelCrudsFunctions<NotificationConfigRecord>
  NotificationTemplates: ModelCrudsFunctions<NotificationTemplateRecord>
}>

export type CoreServices = Readonly<object>

export type CoreServicesLayer = Readonly<{
  [NotificationsNamespace.Core]: CoreServices & {
    cruds: CoreCruds
  }
}>

export type CoreFeatures = Readonly<object>

export type CoreFeaturesLayer = Readonly<{
  [NotificationsNamespace.Core]: CoreFeatures & {
    cruds: CoreCruds
  }
}>

export type NotificationResponse = Response<SendNotificationResult>
