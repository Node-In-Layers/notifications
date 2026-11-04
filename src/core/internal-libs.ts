import { CoreNotificationsConfig } from '../types.js'
import { createTTL } from './libs.js'

const hoursPerDay = 24
const minutesPerHour = 60
const secondsPerMinute = 60
const defaultNotificationTtlDays = 90
const millisecondsPerSecond = 1000

export const defaultNotificationTtlSeconds =
  defaultNotificationTtlDays * hoursPerDay * minutesPerHour * secondsPerMinute

const resolveDefaultTtlSeconds = (
  coreConfig: CoreNotificationsConfig | undefined
): number | undefined => {
  if (coreConfig?.noTTL === true) {
    return undefined
  }
  return coreConfig?.defaultTtl ?? defaultNotificationTtlSeconds
}

const createNotificationTtlFromSecondsFromNow = (
  args: Readonly<{ secondsFromNow: number }>
): number => {
  return createTTL({
    datetime: new Date(
      Date.now() + args.secondsFromNow * millisecondsPerSecond
    ),
  })
}

export const createNotificationTtlLazyLoadMethod = (
  args: Readonly<{ coreConfig: CoreNotificationsConfig | undefined }>
) => {
  return (value: number | undefined): number | undefined => {
    if (value !== undefined && value !== null) {
      return value
    }
    const defaultTtlSeconds = resolveDefaultTtlSeconds(args.coreConfig)
    if (defaultTtlSeconds === undefined) {
      return value
    }
    return createNotificationTtlFromSecondsFromNow({
      secondsFromNow: defaultTtlSeconds,
    })
  }
}
