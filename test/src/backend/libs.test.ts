import { assert } from 'chai'
import { createErrorObject } from '@node-in-layers/core'
import { NotificationsNamespace } from '../../../src/types.js'
import {
  mergeNotificationConfig,
  normalizeFailureError,
} from '../../../src/backend/libs.js'

describe('/src/backend/libs.ts', () => {
  describe('#normalizeFailureError()', () => {
    it('should preserve Node in Layers error objects', () => {
      const input = createErrorObject('BROKEN', 'Broken')
      const actual = normalizeFailureError(input)
      const expected = input.error
      assert.deepEqual(actual, expected)
    })
  })

  describe('#mergeNotificationConfig()', () => {
    it('should overlay database config onto static config', () => {
      const input = {
        staticConfig: {
          adminEmails: ['static@example.com'],
          email: {
            host: 'smtp.example.com',
            port: 587,
            from: 'static@example.com',
          },
          notifiers: {
            email: `${NotificationsNamespace.Backend}.sendEmailNotification`,
          },
        },
        databaseConfig: {
          id: 'config-1',
          key: 'default',
          adminEmails: ['db@example.com'],
          fromEmail: 'db-from@example.com',
        },
      }
      const actual = mergeNotificationConfig(input)
      const expected = {
        adminEmails: ['db@example.com'],
        email: {
          host: 'smtp.example.com',
          port: 587,
          from: 'db-from@example.com',
        },
        notifiers: {
          email: `${NotificationsNamespace.Backend}.sendEmailNotification`,
        },
      }
      assert.deepEqual(actual, expected)
    })
  })
})
