import { ModelProps } from '@node-in-layers/core'
import {
  DatetimeProperty,
  LastModifiedDateProperty,
  TextProperty,
} from 'functional-models'
import { ConfigWithNotifications, NotificationsNamespace } from '../../types.js'
import { NotificationTemplateRecord } from '../types.js'

export const create = ({
  Model,
  getPrimaryKeyProperty,
}: ModelProps<ConfigWithNotifications>) => {
  return Model<NotificationTemplateRecord>({
    pluralName: 'NotificationTemplates',
    singularName: 'NotificationTemplate',
    namespace: NotificationsNamespace.Core,
    primaryKeyName: 'id',
    description: 'Database-backed notification templates by channel and type.',
    properties: {
      id: getPrimaryKeyProperty(
        NotificationsNamespace.Core,
        'NotificationTemplates',
        {
          required: true,
        }
      ),
      channel: TextProperty({
        required: true,
        description: 'Channel name, such as email or sms.',
      }),
      type: TextProperty({
        required: true,
        description: 'Notification type rendered by this template.',
      }),
      body: TextProperty({
        required: true,
        description: 'Handlebars template source.',
      }),
      htmlBody: TextProperty({
        description: 'Optional HTML Handlebars template source for email.',
      }),
      createdAt: DatetimeProperty({
        autoNow: true,
        description: 'When the template row was created.',
      }),
      updatedAt: LastModifiedDateProperty({
        autoNow: true,
        description: 'When the template row was last updated.',
      }),
    },
  })
}
