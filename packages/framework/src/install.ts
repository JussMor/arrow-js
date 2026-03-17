import {
  installAsyncComponentInstaller,
  installHydrationCaptureProvider,
} from '@arrow-js/core/internal'
import { asyncComponent } from './async'
import { getRenderContext } from './context'

let installed = false

export function installFrameworkRuntime() {
  if (installed) {
    return
  }

  installAsyncComponentInstaller(
    asyncComponent as unknown as Parameters<typeof installAsyncComponentInstaller>[0]
  )
  installHydrationCaptureProvider(
    () => getRenderContext()?.hydrationCapture ?? null
  )
  installed = true
}

installFrameworkRuntime()
