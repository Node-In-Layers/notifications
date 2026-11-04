import { FeaturesContext } from '@node-in-layers/core'
import { ConfigWithNotifications } from '../types.js'
import { CoreFeatures, CoreFeaturesLayer, CoreServicesLayer } from './types.js'

export const create = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: FeaturesContext<
    ConfigWithNotifications,
    CoreServicesLayer,
    CoreFeaturesLayer
  >
): CoreFeatures => {
  return {}
}
