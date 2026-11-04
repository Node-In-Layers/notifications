import { assert } from 'chai'
import sinon from 'sinon'
import { create } from '../../../src/backend/features.js'
import { NotificationStatus } from '../../../src/core/types.js'
import { NotificationsNamespace } from '../../../src/types.js'

describe('/src/backend/features.ts', () => {
  describe('#sendNotification()', () => {
    it('should skip persistence and delivery when notifications are disabled', async () => {
      const sendEmail = sinon.stub().resolves({
        messageId: 'should-not-send',
      })
      const input = {
        context: {
          config: {
            systemName: 'test-system',
            environment: 'test',
            [NotificationsNamespace.Backend]: {
              enabled: false,
              email: {
                host: 'smtp.example.com',
                port: 587,
                from: 'notifications@example.com',
              },
            },
          },
          constants: {
            runtimeId: 'runtime-1',
          },
          services: {
            [NotificationsNamespace.Backend]: {
              sendEmail,
            },
            getServices: () => undefined,
          },
          features: {
            getFeatures: () => undefined,
          },
          log: {
            getInnerLogger: () => ({
              debug: () => undefined,
              info: () => undefined,
              warn: () => undefined,
              error: () => undefined,
            }),
          },
        },
      }

      const features = create(input.context as any)
      const actual = await features.sendNotification({
        title: 'Disabled',
        message: 'Do not send.',
        channels: ['email'],
      })

      assert.equal(sendEmail.callCount, 0)
      assert.notProperty(actual, 'error')
      if ('notification' in actual) {
        assert.equal(actual.notification.status, NotificationStatus.Skipped)
      }
    })
  })
})
