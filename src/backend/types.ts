import { CrossLayerProps, LayerFunction, Response } from '@node-in-layers/core'
import { NotificationsPublicFeatures } from '../core/types.js'
import { ConfigWithNotifications, NotificationsNamespace } from '../types.js'

export type SendEmailServiceProps = Readonly<{
  from?: string
  to: readonly string[]
  cc?: readonly string[]
  bcc?: readonly string[]
  replyTo?: string
  subject: string
  text?: string
  html?: string
}>

export type SendEmailServiceResult = Readonly<{
  messageId?: string
  accepted?: readonly string[]
  rejected?: readonly string[]
}>

export type BackendServices = Readonly<{
  sendEmail: LayerFunction<
    (props: SendEmailServiceProps) => Promise<Response<SendEmailServiceResult>>
  >
}>

export type BackendServicesLayer = Readonly<{
  [NotificationsNamespace.Backend]: BackendServices
}>

export type FailureNotificationMetadata = Readonly<{
  domain: string
  functionName: string
}>

export type FailureWrappableFunction = (
  props: any,
  crossLayerProps?: CrossLayerProps
) => any

export type BackendFeatures = NotificationsPublicFeatures &
  Readonly<{
    wrapWithFailureNotification: <TFunction extends FailureWrappableFunction>(
      metadata: FailureNotificationMetadata,
      method: TFunction
    ) => TFunction
  }>

export type BackendFeaturesLayer = Readonly<{
  [NotificationsNamespace.Backend]: BackendFeatures
}>

export type BackendConfig = ConfigWithNotifications
