import { ModelProps } from '@node-in-layers/core'
import {
  ArrayProperty,
  DatetimeProperty,
  LastModifiedDateProperty,
  ObjectProperty,
  TextProperty,
} from 'functional-models'
import { ConfigWithNotifications, NotificationsNamespace } from '../../types.js'
import { NotificationConfigRecord } from '../types.js'

export const create = ({
  Model,
  getPrimaryKeyProperty,
}: ModelProps<ConfigWithNotifications>) => {
  return Model<NotificationConfigRecord>({
    pluralName: 'NotificationConfigs',
    singularName: 'NotificationConfig',
    namespace: NotificationsNamespace.Core,
    primaryKeyName: 'id',
    description: 'Database-driven notification configuration overrides.',
    properties: {
      id: getPrimaryKeyProperty(
        NotificationsNamespace.Core,
        'NotificationConfigs',
        {
          required: true,
        }
      ),
      key: TextProperty({
        required: true,
        description: 'Config lookup key, usually default.',
      }),
      adminEmails: ArrayProperty<string>({
        description: 'Default operational notification recipients.',
      }),
      fromEmail: TextProperty({
        description: 'From address override for email notifications.',
      }),
      subjectPrefix: TextProperty({
        description: 'Subject prefix for email notifications.',
      }),
      defaultChannels: ArrayProperty<string>({
        description: 'Default channel names used when a send omits channels.',
      }),
      notifiers: ObjectProperty<Record<string, string>>({
        description: 'Channel to domain.feature notifier map.',
      }),
      createdAt: DatetimeProperty({
        autoNow: true,
        description: 'When the config row was created.',
      }),
      updatedAt: LastModifiedDateProperty({
        autoNow: true,
        description: 'When the config row was last updated.',
      }),
    },
  })
}
