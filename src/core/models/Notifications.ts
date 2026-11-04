import { CrossLayerProps, ModelProps } from '@node-in-layers/core'
import {
  ArrayProperty,
  DatetimeProperty,
  JsonAble,
  LastModifiedDateProperty,
  ObjectProperty,
  TextProperty,
  TtlProperty,
} from 'functional-models'
import { ConfigWithNotifications, NotificationsNamespace } from '../../types.js'
import {
  Notification,
  NotificationDeliveryResult,
  NotificationStatus,
  NotificationTarget,
  NotificationSeverity,
} from '../types.js'
import { createNotificationTtlLazyLoadMethod } from '../internal-libs.js'

export const create = ({
  context,
  Model,
  getModel,
  getPrimaryKeyProperty,
  getForeignKeyProperty,
}: ModelProps<ConfigWithNotifications>) => {
  const coreConfig = context.config[NotificationsNamespace.Core]
  const userIdProperty = getForeignKeyProperty(
    '@node-in-layers/auth/core',
    'Users',
    getModel('@node-in-layers/auth/core', 'Users'),
    {
      required: false,
      description: 'Optional user id associated with the notification.',
    }
  )
  const taskIdProperty = getForeignKeyProperty(
    '@node-in-layers/tasks',
    'Tasks',
    getModel('@node-in-layers/tasks', 'Tasks'),
    {
      required: false,
      description: 'Optional task id when delivery was queued.',
    }
  )

  return Model<Notification>({
    pluralName: 'Notifications',
    singularName: 'Notification',
    namespace: NotificationsNamespace.Core,
    primaryKeyName: 'id',
    description: 'Notifications sent by Node in Layers systems.',
    properties: {
      id: getPrimaryKeyProperty(NotificationsNamespace.Core, 'Notifications', {
        required: true,
      }),
      type: TextProperty({
        required: true,
        description:
          'Notification type, such as system, executionFailure, or user.',
      }),
      severity: TextProperty({
        required: true,
        choices: Object.values(NotificationSeverity),
        description: 'How important the notification is.',
      }),
      title: TextProperty({
        required: true,
        description: 'Human-readable notification title.',
      }),
      message: TextProperty({
        required: true,
        description: 'Human-readable notification message.',
      }),
      htmlMessage: TextProperty({
        description: 'Optional HTML message body.',
      }),
      data: ObjectProperty<Record<string, JsonAble>>({
        description: 'Template and channel data for this notification.',
      }),
      userId: userIdProperty,
      recipients: ArrayProperty<string>({
        description: 'Simple recipient list, usually email addresses.',
      }),
      targets: ArrayProperty<NotificationTarget>({
        description: 'Channel-aware notification targets.',
      }),
      channels: ArrayProperty<string>({
        description: 'Channels requested for this notification.',
      }),
      notifiers: ObjectProperty<Record<string, string>>({
        description: 'Per-notification notifier map overrides.',
      }),
      idempotencyKey: TextProperty({
        description: 'Optional deduplication key.',
      }),
      status: TextProperty({
        required: true,
        choices: Object.values(NotificationStatus),
        description: 'Current delivery status.',
      }),
      deliveryResults: ObjectProperty<
        Record<string, NotificationDeliveryResult>
      >({
        description: 'Delivery result by channel.',
      }),
      taskId: taskIdProperty,
      crossLayerProps: ObjectProperty<
        CrossLayerProps<Record<string, JsonAble>>
      >({
        description: 'Trace props captured for queued notification delivery.',
      }),
      ttl: TtlProperty({
        description:
          'Optional Unix timestamp in seconds for automatic database roll-out.',
        lazyLoadMethod: createNotificationTtlLazyLoadMethod({ coreConfig }),
      }),
      sentAt: DatetimeProperty({
        description: 'When all delivery attempts completed.',
      }),
      createdAt: DatetimeProperty({
        autoNow: true,
        description: 'When the notification row was created.',
      }),
      updatedAt: LastModifiedDateProperty({
        autoNow: true,
        description: 'When the notification row was last updated.',
      }),
    },
  })
}
