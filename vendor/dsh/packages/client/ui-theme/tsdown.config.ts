import { clientBundle } from '../tsdown.client.ts'

const [lib, client] = clientBundle(
  '@deepseek-ai/dsh-client-ui-theme',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)

export default [{
  ...lib,
  copy: [{ from: 'src/styles/*', to: 'lib/styles' }],
}, client]
