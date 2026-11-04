import { assert } from 'chai'
import {
  createTTL,
  parseNotifierTarget,
  renderNotificationTemplate,
} from '../../../src/core/libs.js'
import {
  NotificationSeverity,
  NotificationStatus,
  NotificationType,
} from '../../../src/core/types.js'

describe('/src/core/libs.ts', () => {
  describe('#createTTL()', () => {
    it('should return the Unix timestamp in seconds for a Date input', () => {
      const input = {
        datetime: new Date('2026-06-03T12:00:00.000Z'),
      }
      const actual = createTTL(input)
      const expected = 1780488000
      assert.equal(actual, expected)
    })
  })

  describe('#parseNotifierTarget()', () => {
    it('should split scoped domains on the last dot', () => {
      const input = {
        notifier: '@node-in-layers/notifications/backend.sendEmailNotification',
      }
      const actual = parseNotifierTarget(input)
      const expected = {
        domain: '@node-in-layers/notifications/backend',
        feature: 'sendEmailNotification',
      }
      assert.deepEqual(actual, expected)
    })
  })

  describe('#renderNotificationTemplate()', () => {
    it('should render standard and custom notification data', () => {
      const input = {
        template: '{{title}} {{channel}} {{reviewUrl}}',
        notification: {
          id: 'notification-1',
          type: NotificationType.User,
          severity: NotificationSeverity.Info,
          title: 'Review',
          message: 'Please review.',
          data: {
            reviewUrl: 'https://example.com/reviews/1',
          },
          status: NotificationStatus.Pending,
        },
        channel: 'email',
      }
      const actual = renderNotificationTemplate(input)
      const expected = 'Review email https://example.com/reviews/1'
      assert.equal(actual, expected)
    })
  })
})
