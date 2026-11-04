import nodemailer from 'nodemailer'
import {
  CrossLayerProps,
  ServicesContext,
  createErrorObject,
  isErrorObject,
} from '@node-in-layers/core'
import { ConfigWithNotifications, NotificationsNamespace } from '../types.js'
import { BackendServices, SendEmailServiceProps } from './types.js'

export const create = (
  context: ServicesContext<ConfigWithNotifications>
): BackendServices => {
  const sendEmail = (
    props: SendEmailServiceProps,
    crossLayerProps?: CrossLayerProps
  ) => {
    return Promise.resolve().then(async () => {
      const log = context.log.getInnerLogger('sendEmail', crossLayerProps)
      const emailConfig = context.config[NotificationsNamespace.Backend]?.email
      if (!emailConfig) {
        return createErrorObject(
          'EMAIL_CONFIG_MISSING',
          'Email configuration is required to send email notifications.'
        )
      }
      if (props.to.length === 0) {
        return createErrorObject(
          'EMAIL_RECIPIENTS_MISSING',
          'At least one email recipient is required.'
        )
      }

      const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
        ...(emailConfig.transportOptions ?? {}),
      })
      const result = await transporter
        .sendMail({
          from: props.from ?? emailConfig.from,
          to: props.to.join(', '),
          cc: props.cc?.join(', '),
          bcc: props.bcc?.join(', '),
          replyTo: props.replyTo,
          subject: props.subject,
          text: props.text,
          html: props.html,
        })
        .catch(error => {
          const errorObject = createErrorObject(
            'EMAIL_SEND_FAILED',
            'Failed to send email notification.',
            error
          )
          log.error('Failed to send email notification', errorObject)
          return errorObject
        })

      if (isErrorObject(result)) {
        return result
      }

      return {
        messageId: result.messageId,
        accepted: result.accepted?.map(String) ?? [],
        rejected: result.rejected?.map(String) ?? [],
      }
    })
  }

  return {
    sendEmail,
  }
}
