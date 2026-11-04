# Notifications - Node In Layers

![Unit Tests](https://github.com/node-in-layers/notifications/actions/workflows/ut.yml/badge.svg?branch=main)
[![Coverage Status](https://coveralls.io/repos/github/Node-In-Layers/notifications/badge.svg?branch=main)](https://coveralls.io/github/Node-In-Layers/notifications?branch=main)

<img src="./public/nil.png" width="160" height="150" />

Send notifications from Node in Layers systems.

This notification framework is modular and expandable. By default it comes with the ability to send emails, but by implementing the simple notification channel interface, anything can be used to send notifications.

At a high level this package can:

- Be used on front ends as well as backends
- Send system notifications
- Send notifications to users
- Support multi-channel delivery
- Support templated notification messages by message type and channel
- Create custom notifiers
- Be configured locally or via a database model
- Configured to utilize tasks/queue messaging bus

## Out of the Box Notifiers

This package provides notifiers for:

- Email

## Quick start

### Install

```bash
npm install @node-in-layers/notifications
```

If you persist notifications, or you resolve users from `@node-in-layers/auth`, also install the packages those features use (`@node-in-layers/data`, `@node-in-layers/auth`).

### Configure

Register both domains. Core comes before backend. For email, set `email`. For another channel only, set `notifiers` and leave `email` out. `email` is required only when `notifiers` is omitted.

```typescript
import { CoreNamespace } from '@node-in-layers/core'
import {
  notificationsCore,
  NotificationsNamespace,
} from '@node-in-layers/notifications'
import * as notificationsBackend from '@node-in-layers/notifications/backend/index.js'

const config = {
  [CoreNamespace.root]: {
    domains: [
      // node-in-layers/data goes here if using database models
      notificationsCore, // core before backend
      notificationsBackend,
      // Insert user domains after
    ],
  },
  [NotificationsNamespace.Backend]: {
    adminEmails: ['ops@example.com'],
    email: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SMTP_PASSWORD,
      },
      from: 'notifications@example.com',
    },
  },
}
```

`adminEmails` is who receives a system notification when the call does not pass its own recipients. `email.from` is the From address on every email this package sends.

### Example: Send a system notification

```typescript
import { NotificationsNamespace } from '@node-in-layers/notifications'

const response = await context.features[
  NotificationsNamespace.Backend
].sendSystemNotification(
  {
    title: 'Deploy finished',
    message: 'The nightly import completed.',
    severity: 'info',
  },
  crossLayerProps
)
```

That email goes to `adminEmails`. The subject and body are rendered from the built-in system template. `data` on the call is available inside that template.

### Example: Notify when a feature fails

Wrap the feature. If it throws, or if it returns a Node in Layers error object, a system notification is sent and the original failure is returned to the caller.

```typescript
import { FeaturesContext, annotatedFunction } from '@node-in-layers/core'
import { NotificationsNamespace } from '@node-in-layers/notifications'
import { z } from 'zod'

export const create = (context: FeaturesContext<any, any>) => {
  const notifications = context.features[NotificationsNamespace.Backend]

  const createUser = notifications.wrapWithFailureNotification(
    {
      domain: 'users',
      functionName: 'createUser',
    },
    annotatedFunction(
      {
        functionName: 'createUser',
        domain: 'users',
        description: 'Creates a user.',
        args: z.object({
          email: z.string(),
          firstName: z.string(),
        }),
        returns: z.object({
          id: z.string(),
        }),
      },
      async (props, crossLayerProps) => {
        const log = context.log.getInnerLogger('createUser', crossLayerProps)
        log.info('Creating user', { email: props.email })

        const created = await context.services.users.insertUser(
          props,
          crossLayerProps
        )
        return { id: created.id }
      }
    )
  )

  return {
    createUser,
  }
}
```

The failure email includes the domain, function name, error, and the arguments that were passed in.

You can also send that notification yourself:

```typescript
const created = await context.services.users
  .insertUser(props, crossLayerProps)
  .catch(async error => {
    await context.features[
      NotificationsNamespace.Backend
    ].sendExecutionFailureNotification(
      {
        domain: 'users',
        functionName: 'createUser',
        error,
        args: props,
      },
      crossLayerProps
    )
    throw error
  })
```

### Example: Send a user notification

`sendUserNotification` emails the `user` you pass. That is the person this notification is for. `crossLayerProps.user` is the logged-in user and is not read.

```typescript
await context.features[NotificationsNamespace.Backend].sendUserNotification(
  {
    user: approver,
    title: 'Please review your account',
    message: 'A change is waiting for your approval.',
    data: {
      reviewUrl: 'https://app.example.com/reviews/42',
    },
  },
  crossLayerProps
)
```

The template receives the user on `data.user`, so a custom template can say `Hello {{user.firstName}}`.

## About This Package

### Domains

#### NotificationNamespace.Core (@node-in-layers/notifications)

Contains all of the types, schemas and model definitions.

#### NotificationNamespace.Backend (@node-in-layers/notifications/backend)

Contains the backend implementation framework for notifications.

#### NotificationNamespace.Email (@node-in-layers/notifications/email)

Contains out of the box email implementation. Not required to be imported.

## Features

These live on `context.features[NotificationNamespace.Backend`

| Feature                            | Type               | What it does                                                                                                                             |
| ---------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sendSystemNotification`           | `system`           | Sends an operational message. Recipients default to `adminEmails`.                                                                       |
| `sendExecutionFailureNotification` | `executionFailure` | Sends a notification for a failed feature or service. Formats an `Error` or a Node in Layers error object into `data.error`.             |
| `wrapWithFailureNotification`      | `executionFailure` | Wraps a function. On throw or on a returned error object, sends `sendExecutionFailureNotification`, then preserves the original failure. |
| `sendUserNotification`             | `user`             | Sends to the `user` passed on the call. With email, that uses `user.email`.                                                              |
| `sendNotification`                 | caller sets `type` | Sends a notification of any type, including one you define.                                                                              |

### Notification type

Every notification has a `type`. The type chooses the template and decides what is in `data`.

The three built-in types are used by the provided features. Therefore you do not pass `type` to those features.

| Type               | Set by                             | `data` contains                                                                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `system`           | `sendSystemNotification`           | `systemName`, `environment`, `runtimeId`, `datetime`, `ids`, plus any `data` you passed.                            |
| `executionFailure` | `sendExecutionFailureNotification` | Everything on `system`, plus `domain`, `functionName`, `args`, and `error` (`code`, `message`, `details`, `trace`). |
| `user`             | `sendUserNotification`             | `user` (`id`, `email`, `firstName`, `lastName`, `username`), plus any `data` you passed.                            |

### Sending Your Own Typed Notifications

`sendNotification` is how you send your own type. Pass `type` as a string, for example `accountReview`. Put the fields that template expects on `data`. A template for that type can use those fields directly: `{{reviewUrl}}`.

Your `data` is merged in. Fields the feature already set for that type stay as the feature set them.

### Saved Notifications Model

When `persistNotifications` is true and model CRUDs are available, each send is stored on the `Notifications` model. Status moves from `pending` to `sent`, `partial_failure`, or `failed`. When backend config has `enabled: false`, the package exits quickly, returns an in-memory notification with status `skipped`, and does not persist, enqueue, or deliver anything.

`NotificationConfigs` is optional. With `useDatabaseConfig: true`, a row whose `key` is `default` (or `databaseConfigKey`) overrides the static config: admin emails, from address, and the notifier map. Saved template bodies live on `NotificationTemplates`, not on that row.

A template is a Handlebars source string for one channel and one type. The same type can have a different string per channel. Dispatch resolves that string, and the notifier renders it into what that channel sends.

## Core configuration

Put this on `[NotificationsNamespace.Core]`, which is `'@node-in-layers/notifications'`. It only affects stored notification rows.

| Field        | Used for                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| `defaultTtl` | Optional. Seconds from creation until a stored notification's `ttl`. Default is 90 days. |
| `noTTL`      | When `true`, stored notifications have no `ttl`.                                         |

A single send can pass `ttl`, in seconds, to override `defaultTtl` for that notification. `ttl` is written only when `persistNotifications` is true.

## Backend configuration

Put this on `[NotificationsNamespace.Backend]`, which is `'@node-in-layers/notifications/backend'`.

`email` is required only when `notifiers` is omitted. If `notifiers` is set, those channels are used and SMTP is not required.

### `enabled`

Notifications are enabled by default. Set `enabled: false` on `[NotificationsNamespace.Backend]` to turn the package into a no-op. Any call to `sendNotification`, `sendSystemNotification`, `sendExecutionFailureNotification`, or `sendUserNotification` returns quickly with status `skipped` and without persisting, enqueueing, or delivering anything.

```typescript
[NotificationsNamespace.Backend]: {
  enabled: false,
}
```

### `email`

SMTP settings for the built-in email notifier. Omit this block when every channel you use is one of your own notifiers. When this block is set and `notifiers` is omitted, notifications go out through email.

| Field              | Used for                                                                          |
| ------------------ | --------------------------------------------------------------------------------- |
| `host`             | SMTP hostname.                                                                    |
| `port`             | SMTP port.                                                                        |
| `secure`           | `true` for implicit TLS (typically port 465). Leave `false` for STARTTLS on 587.  |
| `auth.user`        | SMTP username.                                                                    |
| `auth.pass`        | SMTP password or API key. Read this from the environment.                         |
| `from`             | From address on every email.                                                      |
| `defaultTo`        | Recipients used when a notification has no recipients and `adminEmails` is empty. |
| `subjectPrefix`    | Text prepended to every subject, for example `[my-app]`.                          |
| `transportOptions` | Extra options passed through to Nodemailer.                                       |

### Who gets system mail

| Field         | Used for                                                                         |
| ------------- | -------------------------------------------------------------------------------- |
| `adminEmails` | Default recipients for system notifications and execution-failure notifications. |

### `templates`

`templates` maps a channel and a type to a Handlebars source string. A missing pair uses `message` as the body. [Templates](#templates) covers how that string is written, bundled, saved, and which variables it receives.

### Channels

| Field             | Used for                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notifiers`       | Map of channel name to a custom `domain.feature` notifier. Omit this to use the built-in email channel when `email` is configured. Include an `email` key only when you want to override the built-in mailer with your own notifier. |
| `defaultChannels` | Channels used when a call does not pass `channels` or `targets`. Omit it to use every key in the notifier map. With no notifier map and `email` set, that is `email`.                                                                |

```typescript
[NotificationsNamespace.Backend]: {
  email: {
    host: 'smtp.example.com',
    port: 587,
    from: 'notifications@example.com',
  },
  notifiers: {
    slack: 'slack.sendSlackNotification',
  },
  defaultChannels: ['email', 'slack'],
}
```

### Users

`sendUserNotification` uses the `user` argument. Pass the person to notify. When the call has `userId` and no `user`, that id is loaded from the user model.

| Field                                | Used for                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userResolution.userModel`           | `domain.PluralModelName` of the user model. Default is `@node-in-layers/auth/core.Users`, or `userModel` from the auth core config when that is set.                                                                                  |
| `userResolution.userResolverFeature` | `domain.feature` that returns a user for a `userId`, when you do not want a model retrieve.                                                                                                                                           |
| `userResolution.defaultChannels`     | Channels used for user notifications when the call does not pass `channels`. When omitted, user notifications use the same default channels as other sends. Email uses `user.email`. A channel such as `sms` uses `user.phoneNumber`. |

A disabled user (`enabled: false`) is not notified.

### Persistence and database config

| Field                  | Used for                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `persistNotifications` | When `true`, each notification is saved with the core `Notifications` model. Requires model CRUDs. Default is off, so a system with only SMTP still sends mail. |
| `useDatabaseConfig`    | When `true`, loads one `NotificationConfigs` row and overlays it on this config.                                                                                |
| `databaseConfigKey`    | Key of that row. Default is `default`.                                                                                                                          |
| `useDatabaseTemplates` | When `true`, loads a `NotificationTemplates` row for the channel and type being sent. A row replaces the config string for that pair.                           |

The `NotificationConfigs` row can set `adminEmails`, `fromEmail`, `subjectPrefix`, and `notifiers`. Values on the row replace the matching static values. Template bodies are not stored on that row.

### `tasks`

`tasks` is optional. Leave it unset to send during the feature call.

| Field           | Used for                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks.enabled` | When `true`, a send is placed on the `@node-in-layers/tasks` queue instead of being delivered during the call. That backend must be loaded. When omitted or `false`, the notification is sent during the feature call. |

```typescript
[NotificationsNamespace.Backend]: {
  tasks: {
    enabled: true,
  },
}
```

## Templates

`templates[channel][type]` is a Handlebars source string. It is not a file path. `Handlebars.compile` turns that string into a function at render time. You do not put that function, or a precompiled template object, in config. A database row stores the same source string.

```typescript
templates: {
  email: {
    executionFailure: executionFailureEmail,
  },
  sms: {
    executionFailure: executionFailureSms,
  },
}
```

A string on an email type is the plain-text body. `title` is the subject. When that email also needs HTML, set an object of source strings. `text` and `html` are each optional.

```typescript
templates: {
  email: {
    executionFailure: {
      text: executionFailureEmailText,
      html: executionFailureEmailHtml,
    },
  },
}
```

Other channels stay a single string. That string is the whole payload.

Leave a channel and type unset and that channel uses `message` as the body.

### Bundling templates with esbuild

If you are going to esbuild bundle your system note that by default handlebar template paths will not be included. However, there are two solutions available.

1. You can put the templates as strings inside of a typescript/javascript file.
2. You can import ".hbs" files directly in with Node 26 or newer.

#### Importing HBS Files Directly

When the app is built with esbuild, import each template at the top of the module that builds this config, and put that binding in `templates`. Do not put a file path there.

```typescript
import executionFailureEmail from './templates/email/execution-failure.hbs' with { type: 'text' }
import executionFailureSms from './templates/sms/execution-failure.hbs' with { type: 'text' }
```

When running esbuild with bundle, esbuild reads the `.hbs` file during the build and writes the source into the output as a string. The file is not read again when the process starts, and it does not have to be deployed next to the bundle.

```bash
esbuild src/config.mjs --bundle --outfile=dist/config.js
```

```javascript
var executionFailureEmail = '<p>{{domain}}.{{functionName}} failed</p>\n'
```

`--bundle` is required for that. Without it, esbuild reprints the import and the template stays out of the output.

`tsc` does not know a `.hbs` import. Add this declaration so typechecking accepts it:

```typescript
declare module '*.hbs' {
  const source: string
  export default source
}
```

### Saved templates

`NotificationTemplates` stores one template per channel and type. Turn this on with `useDatabaseTemplates: true`. Model CRUDs must be available. This is separate from `persistNotifications`: you can save templates without saving each send.

| Field      | Used for                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| `channel`  | Channel key, such as `email` or `sms`.                                   |
| `type`     | Notification type, such as `executionFailure` or `accountReview`.        |
| `body`     | Handlebars source. This becomes `template` on the notifier.              |
| `htmlBody` | Optional HTML source for the email channel. This becomes `htmlTemplate`. |

Dispatch looks up the row for the channel and type on that send. A row replaces `templates[channel][type]` from config. No row means the config string is used. Neither one means the notifier receives no template and sends `message`.

These variables are already in every template. You do not put them on `data`.

| Variable      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| `title`       | Notification title.                                        |
| `message`     | Notification message.                                      |
| `severity`    | `info`, `warning`, `error`, or `critical`.                 |
| `type`        | Notification type, such as `system` or `user`.             |
| `channel`     | Channel rendering this template, such as `email` or `sms`. |
| `systemName`  | `systemName` from config.                                  |
| `environment` | Current environment.                                       |
| `runtimeId`   | Runtime id for this process.                               |
| `datetime`    | Time of the send.                                          |

`executionFailure` also has these:

| Variable        | Value                                 |
| --------------- | ------------------------------------- |
| `domain`        | Domain whose function failed.         |
| `functionName`  | Function that failed.                 |
| `args`          | Arguments passed to that function.    |
| `error.code`    | Error code, when the failure has one. |
| `error.message` | Error message.                        |
| `error.details` | Extra error text, when present.       |
| `error.trace`   | Stack trace, when present.            |

`user` also has `user.id`, `user.email`, `user.firstName`, `user.lastName`, `user.username`, and `user.phoneNumber`.

Keys you pass on `data` are available by name next to these. `data.reviewUrl` is `{{reviewUrl}}`. A key you pass does not replace a variable the feature already set for that type.

## Create your own notifier

A notifier is the feature for one channel. Dispatch looks up `notifiers[channel]`, splits the `domain.feature` string, and calls that feature once per notification. The feature turns the notification into whatever that channel sends. Email renders a subject and a body. SMS renders one short string. Your feature does the same for its own channel.

Put the contract next to your feature. `createNotificationChannelSchema` is exported from `@node-in-layers/notifications`.

The first type argument is an optional shape of `notification.data`. That is the data for the notification type this channel handles. A channel that handles more than one type uses a union. The second type argument is the shape of `options`. Leave it off when the notifier does not read `options`.

```typescript
import { annotatedFunction } from '@node-in-layers/core'
import {
  createNotificationChannelSchema,
  renderNotificationTemplate,
} from '@node-in-layers/notifications'

type AccountReviewData = Readonly<{
  reviewUrl: string
}>

type SlackOptions = Readonly<{
  username?: string
}>

const SendSlackNotificationSchema = createNotificationChannelSchema<
  AccountReviewData,
  SlackOptions
>({
  functionName: 'sendSlackNotification',
  domain: 'slack',
  description: 'Posts a notification into Slack.',
})

export const create = context => {
  const sendSlackNotification = annotatedFunction(
    SendSlackNotificationSchema,
    async (props, crossLayerProps) => {
      const text = props.template
        ? renderNotificationTemplate({
            template: props.template,
            notification: props.notification,
            channel: props.channel,
          })
        : props.notification.message

      await context.services.slack.postMessage(
        {
          channel: props.target?.channelId,
          text,
          username: props.options?.username,
        },
        crossLayerProps
      )

      return {
        channel: props.channel,
        notifier: 'slack.sendSlackNotification',
        success: true,
      }
    }
  )

  return {
    sendSlackNotification,
  }
}
```

The feature receives:

| Field          | Meaning                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`      | The key from `notifiers`, such as `slack` or `email`.                                                                                                     |
| `notification` | The notification: `type`, `title`, `message`, `data`, recipients, and the rest of the stored record.                                                      |
| `target`       | Present when the caller passed a target for this channel (`to`, `phoneNumbers`, `url`, `channelId`, and so on).                                           |
| `template`     | Handlebars source for this channel and `notification.type`. Omitted when neither config nor a saved row has one.                                          |
| `htmlTemplate` | HTML source for the email channel, when the template was an object with `html` or the saved row has `htmlBody`.                                           |
| `options`      | Optional object from the send. The second type argument of `createNotificationChannelSchema` sets its keys. Omitted when the call did not pass `options`. |

`renderNotificationTemplate` compiles `template` and renders it with the [standard template variables](#templates). The notifier decides what to do with the string. Slack posts it. The built-in email notifier uses `title` as the subject, `template` as the plain-text body, and `htmlTemplate` as the HTML body when it is present.

Return `{ channel, notifier, success: true }` when the send worked. Return a Node in Layers error object when it did not. Dispatch records each result on the notification.

Point the channel at your feature. This setup does not use email:

```typescript
[NotificationsNamespace.Backend]: {
  notifiers: {
    slack: 'slack.sendSlackNotification',
  },
}
```

When `email` is configured and no custom `email` notifier is set, the built-in email channel is used. Include `email` in the notifier map only when you want to override that built-in behavior.

Send on that channel by name:

```typescript
await context.features[NotificationsNamespace.Backend].sendNotification(
  {
    title: 'Build failed',
    message: 'main is red.',
    channels: ['slack'],
    options: {
      username: 'deploy-bot',
    },
    targets: [
      {
        channel: 'slack',
        channelId: 'deploys',
      },
    ],
  },
  crossLayerProps
)
```

A single call can include both `email` and `slack`. Each channel runs its own notifier.

## Primary key type

Notification models do not choose an id type. Each model takes its primary key from `getPrimaryKeyProperty` in `@node-in-layers/core`, the same way other Node in Layers packages do (Example: `@node-in-layers/auth`). The default is `PropertyType.UniqueId`, a string UUID.

A database that uses integers sets that type on the core config. It applies to every model in the system, including notifications.

```typescript
import { CoreNamespace } from '@node-in-layers/core'
import { PropertyType } from 'functional-models'

const config = {
  [CoreNamespace.root]: {
    modelIdPropertyType: PropertyType.Integer,
  },
}
```

To change only these models, set `modelNameToIdPropertyType`. The key is `domain/PluralModelName`.

```typescript
[CoreNamespace.root]: {
  modelNameToIdPropertyType: {
    '@node-in-layers/notifications/Notifications': PropertyType.Integer,
    '@node-in-layers/notifications/NotificationConfigs': PropertyType.Integer,
    '@node-in-layers/notifications/NotificationTemplates': PropertyType.Integer,
  },
}
```

For integer keys, take the id from the database rather than generating one in the process. Set `primaryKeyGenerator` on the same core config when the database should supply it.
